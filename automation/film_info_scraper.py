# -*- coding: utf-8 -*-
r"""
FilmInformation WEEKLY COLLECTIONS harvester (history, 2021-12-10..today)

Outputs TWO CSVs:
  1) Wide (pivot):  <out_prefix>_wide_city_movie_totals_weeks.csv
     Columns: Movie Title, release_year, City, Day 1 gross, Week 1 ... Week N (capped), total gross,
              movie total gross, Cume D1, Cume D1+W1, Cume D1+W1+W2, ... , Cume total
  2) Detail (rows): <out_prefix>_detail_city_movie_totals_weeks.csv
     Columns: movie, release_year, city, cinemas_reported, gross_reported, week_start, week_end, update_date,
              week_number, cummulative gross, total gross, movie total gross

Highlights:
- Robust month/year-crossing parsing (e.g., Dec 29, 2023 – Jan 4, 2024), commas optional.
- Slug variants: with/without "-to-", AMP endings/params stripped.
- Thursday Day-1 detection from “opened on …”.
- Hindi-only cleanup for embedded "(Hindi)" and "(N shows)" in bold titles; keep non-Hindi qualifiers.
- Hyderabad/Madras/Visakhapatnam sub-city splits; 1.18× adjusted gross; wide cumulative columns.
- Release year from first appearance; incremental synchronization to Turso.

Usage (Windows cmd.exe):
  set OUT=%USERPROFILE%\Downloads\weekly_exports
  mkdir "%OUT%"
  cd /d C:/Users/vinay/Documents
  py film_info_scraper.py --from 2021-12-10 --to today --out-dir "%OUT%" --out-prefix "weekly_all" --max-weeks 20
"""

import re, os, sys, time, random, argparse, datetime as dt, glob
from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict, Iterable
from urllib.parse import urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup, Tag
import pandas as pd

# ----------------------------
# Config
# ----------------------------
BASE = "https://filminformation.com"
ARCHIVE_CANDIDATES = [
    f"{BASE}/category/box-office/weekly-collection",
    f"{BASE}/category/featured",
]
SEARCH_PAGES = [
    f"{BASE}/?s=WEEKLY+COLLECTIONS",
]
UA_LIST = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
]
HEADERS = lambda: {"User-Agent": random.choice(UA_LIST), "Accept-Language": "en-US,en;q=0.9"}
REQ_TIMEOUT = 30
MAX_PAGES_PER_SOURCE = 60

# ----------------------------
# Turso publish config
# ----------------------------
# Keep credentials OUT of this file.
# GitHub Actions will provide:
#   TURSO_DATABASE_URL=libsql://...
#   TURSO_AUTH_TOKEN=...
# Optional:
#   TURSO_TABLE=film_collection_wide
TURSO_DATABASE_URL = os.getenv("TURSO_DATABASE_URL", "").strip()
TURSO_AUTH_TOKEN = os.getenv("TURSO_AUTH_TOKEN", "").strip()
TURSO_TABLE = os.getenv("TURSO_TABLE", "film_collection_wide").strip()
TURSO_BATCH_SIZE = 500

# ----------------------------
# Networking helpers
# ----------------------------
def normalize_url(u: str) -> str:
    if not u:
        return u
    # strip query (?amp etc) and fragments
    parts = list(urlsplit(u))
    parts[3] = ""  # query
    parts[4] = ""  # fragment
    u2 = urlunsplit(parts)
    # strip trailing '/amp' or '/amp/'
    u2 = re.sub(r'/amp/?$', '/', u2, flags=re.IGNORECASE)
    return u2

def fetch_html(url: str, max_tries: int = 5, backoff_sec: float = 2.0) -> str:
    last = None
    for _ in range(max_tries):
        try:
            r = requests.get(url, headers=HEADERS(), timeout=REQ_TIMEOUT)
            if r.status_code == 200 and r.text:
                return r.text
            last = f"status {r.status_code}"
        except Exception as e:
            last = str(e)
        time.sleep(backoff_sec * (1 + random.random()))
    raise RuntimeError(f"Failed to fetch {url}: {last}")

def extract_main_node(html: str) -> Tag:
    soup = BeautifulSoup(html, "lxml")
    node = (
        soup.select_one(".entry-content") or
        soup.select_one("article") or
        soup.select_one(".post-content") or
        soup.select_one(".post")
    )
    return node or soup

# ----------------------------
# Date parsing from title/slug
# ----------------------------
MONTHS = {m.lower(): i for i, m in enumerate(
    ["January","February","March","April","May","June","July","August","September","October","November","December"], 1)}
def month_to_num(name: str) -> int:
    return MONTHS[name.strip().lower()]

# Title variants
# Two-year (start and end years both shown); commas optional
TITLE_DATES_RE_2Y = re.compile(
    r'^WEEKLY\s+COLLECTIONS\s+([A-Za-z]+)\s+(\d{1,2})(?:,\s*)?(\d{4})\s*(?:-|–|—|to)\s*'
    r'([A-Za-z]+)\s+(\d{1,2})(?:,\s*)?(\d{4}).*?'
    r'(\d{1,2})\s+([A-Za-z]+)(?:,)?\s*(\d{4})',
    re.IGNORECASE
)
# One-year (site often prints only end year); commas optional
TITLE_DATES_RE_1Y = re.compile(
    r'^WEEKLY\s+COLLECTIONS\s+([A-Za-z]+)\s+(\d{1,2})(?:,\s*)?\s*(?:-|–|—|to)\s*'
    r'(?:([A-Za-z]+)\s+)?(\d{1,2})(?:,\s*)?\s*(\d{4}).*?'
    r'(\d{1,2})\s+([A-Za-z]+)(?:,)?\s*(\d{4})',
    re.IGNORECASE
)

# Slug variants
# cross-month, cross-year, optional "-to-"
SLUG_TWO_MONTHS_2Y = re.compile(
    r'weekly-collections-([a-z]+)-(\d{1,2})-(\d{4})-(?:to-)?([a-z]+)-(\d{1,2})-(\d{4})-'
    r'(\d{1,2})-([a-z]+)-(\d{4})/?$',
    re.IGNORECASE
)
# cross-month, same-year (end year shown once)
SLUG_TWO_MONTHS_1Y = re.compile(
    r'weekly-collections-([a-z]+)-(\d{1,2})-(?:to-)?([a-z]+)-(\d{1,2})-(\d{4})-'
    r'(\d{1,2})-([a-z]+)-(\d{4})/?$',
    re.IGNORECASE
)
# one-month, same-year
SLUG_ONE_MONTH = re.compile(
    r'weekly-collections-([a-z]+)-(\d{1,2})-(\d{1,2})-(\d{4})-'
    r'(\d{1,2})-([a-z]+)-(\d{4})/?$',
    re.IGNORECASE
)

@dataclass
class WeekMeta:
    url: str
    title: str
    week_start: dt.date  # Friday
    week_end: dt.date    # Thursday
    update_date: dt.date # Saturday

def parse_week_from_title(title: str, url: str) -> Optional['WeekMeta']:
    t = title.strip()
    m2y = TITLE_DATES_RE_2Y.search(t)
    if m2y:
        m1name, d1, y1, m2name, d2, y2, upd_d, upd_mname, upd_y = m2y.groups()
        d1, d2, y1, y2, upd_d, upd_y = int(d1), int(d2), int(y1), int(y2), int(upd_d), int(upd_y)
        start = dt.date(y1, month_to_num(m1name), d1)
        end   = dt.date(y2, month_to_num(m2name), d2)
        update = dt.date(upd_y, month_to_num(upd_mname), upd_d)
        return WeekMeta(url=url, title=t, week_start=start, week_end=end, update_date=update)
    m1y = TITLE_DATES_RE_1Y.search(t)
    if m1y:
        mname1, d1, mname2_opt, d2, y_end, upd_d, upd_mname, upd_y = m1y.groups()
        d1, d2, y_end, upd_d, upd_y = int(d1), int(d2), int(y_end), int(upd_d), int(upd_y)
        m1 = month_to_num(mname1)
        m2 = month_to_num(mname2_opt) if mname2_opt else m1
        start = dt.date(y_end, m1, d1)   # assume same year as end
        end   = dt.date(y_end, m2, d2)
        if start > end:
            # e.g., Dec 29 to Jan 4 with only "2024" printed => start should be previous year
            start = dt.date(y_end - 1, m1, d1)
        update = dt.date(upd_y, month_to_num(upd_mname), upd_d)
        return WeekMeta(url=url, title=t, week_start=start, week_end=end, update_date=update)
    return None

def parse_week_from_slug(url: str, title: str) -> Optional['WeekMeta']:
    slug = normalize_url(url).rstrip("/")
    # Try cross-year first
    m2y = SLUG_TWO_MONTHS_2Y.search(slug)
    if m2y:
        m1name, d1, y1, m2name, d2, y2, upd_d, upd_mname, upd_y = m2y.groups()
        d1, d2, y1, y2, upd_d, upd_y = int(d1), int(d2), int(y1), int(y2), int(upd_d), int(upd_y)
        start = dt.date(y1, month_to_num(m1name), d1)
        end   = dt.date(y2, month_to_num(m2name), d2)
        update = dt.date(upd_y, month_to_num(upd_mname), upd_d)
        return WeekMeta(url=slug, title=title.strip() or slug, week_start=start, week_end=end, update_date=update)
    # cross-month same-year
    m1y = SLUG_TWO_MONTHS_1Y.search(slug)
    if m1y:
        m1name, d1, m2name, d2, y, upd_d, upd_mname, upd_y = m1y.groups()
        d1, d2, y, upd_d, upd_y = int(d1), int(d2), int(y), int(upd_d), int(upd_y)
        start = dt.date(y, month_to_num(m1name), d1)
        end   = dt.date(y, month_to_num(m2name), d2)
        if start > end:
            start = dt.date(y - 1, month_to_num(m1name), d1)
        update = dt.date(upd_y, month_to_num(upd_mname), upd_d)
        return WeekMeta(url=slug, title=title.strip() or slug, week_start=start, week_end=end, update_date=update)
    # one-month
    m0 = SLUG_ONE_MONTH.search(slug)
    if m0:
        mname, d1, d2, y, upd_d, upd_mname, upd_y = m0.groups()
        d1, d2, y, upd_d, upd_y = int(d1), int(d2), int(y), int(upd_d), int(upd_y)
        start = dt.date(y, month_to_num(mname), d1)
        end   = dt.date(y, month_to_num(mname), d2)
        update = dt.date(upd_y, month_to_num(upd_mname), upd_d)
        return WeekMeta(url=slug, title=title.strip() or slug, week_start=start, week_end=end, update_date=update)
    return None

# ----------------------------
# Discover weekly posts
# ----------------------------
def discover_via_rest_search() -> List[Tuple[str,str]]:
    out = []
    page = 1
    while True:
        try:
            url = f"{BASE}/wp-json/wp/v2/search?search=WEEKLY%20COLLECTIONS&subtype=post&per_page=100&page={page}"
            r = requests.get(url, headers=HEADERS(), timeout=REQ_TIMEOUT)
            if r.status_code != 200:
                break
            data = r.json()
            if not data:
                break
            for item in data:
                out.append((normalize_url(item.get("url") or ""), item.get("title") or ""))
            page += 1
            if page > 30:
                break
        except Exception:
            break
    return out

def discover_via_search_pages() -> List[Tuple[str,str]]:
    out = []
    for base in SEARCH_PAGES:
        for p in range(1, MAX_PAGES_PER_SOURCE + 1):
            url = base if p == 1 else f"{base}&paged={p}"
            try:
                html = fetch_html(url)
            except Exception:
                break
            soup = BeautifulSoup(html, "lxml")
            hits = soup.select("h2 a, h3 a, .entry-title a")
            if not hits:
                break
            for a in hits:
                t = (a.get_text(strip=True) or "")
                if "WEEKLY COLLECTIONS" in t.upper():
                    out.append((normalize_url(a.get("href") or ""), t))
    return out

def discover_via_archives() -> List[Tuple[str,str]]:
    out = []
    for base in ARCHIVE_CANDIDATES:
        for p in range(1, MAX_PAGES_PER_SOURCE + 1):
            page_url = base if p == 1 else f"{base}/page/{p}/"
            try:
                html = fetch_html(page_url)
            except Exception:
                break
            soup = BeautifulSoup(html, "lxml")
            links = soup.select("h2 a, h3 a, .entry-title a")
            if not links:
                links = soup.select("article a")
            for a in links:
                t = (a.get_text(strip=True) or "")
                if "WEEKLY COLLECTIONS" in t.upper():
                    out.append((normalize_url(a.get("href") or ""), t))
    return out

def collect_week_posts() -> List[Tuple[str,str]]:
    candidates: Dict[str,str] = {}
    for (url, title) in (discover_via_rest_search() +
                         discover_via_search_pages() +
                         discover_via_archives()):
        if not url:
            continue
        url_n = normalize_url(url)
        candidates[url_n] = title or candidates.get(url_n, "")
    return [(u, candidates[u]) for u in candidates.keys()]

# ----------------------------
# Text parsing helpers
# ----------------------------
def parse_indian_number(s: str) -> Optional[int]:
    if not s:
        return None
    s = s.strip().replace(',', '')
    m = re.search(r'(\d+)', s)
    return int(m.group(1)) if m else None

def norm_space(s: str) -> str:
    return re.sub(r'\s+', ' ', s or '').strip()

def is_city_header_text(t: str) -> Optional[str]:
    if not t:
        return None
    t = t.strip()
    if t.endswith(":"):
        core = t[:-1].strip()
        if re.fullmatch(r'[A-Z0-9\s&./-]+', core) and len(core) >= 3:
            return core.title()
    return None

INLINE_CITY_PREFIX = re.compile(r'^\s*([A-Z][A-Z\s&./-]+):\s+')
WEEK_MARKER = re.compile(r'\b\d+(?:st|nd|rd|th)\s+week\b', re.IGNORECASE)
OPENED_ON_RE = re.compile(r'opened\s+on\s+(\d{1,2})(?:st|nd|rd|th)?', re.IGNORECASE)
CINEMA_ENTRY_RE = re.compile(
    r'(?P<cinema>[^,()]+?)\s*(?:\((?P<shows>\d+)\s+shows?\))?\s*(?P<gross>[0-9,]{2,})\s*(?:,|$)',
    re.IGNORECASE
)
TOTAL_LINE_RE = re.compile(
    r'\btotal\s+from\s+(?P<ncin>\d+)\s+cinemas?\s+(?P<total>[0-9,]+)\s*\.\s*$', re.IGNORECASE
)

# Embedded-in-title cleanups
SHOWS_PAREN_RE = re.compile(r'\(\s*\d{1,4}\s*shows?\s*\)', re.IGNORECASE)
HINDI_PAREN_RE = re.compile(r'\(\s*(?:in\s+)?hindi\s*\)', re.IGNORECASE)

LANG_TOKENS = [
    "dubbed","telugu","tamil","kannada","malayalam","marathi","bengali",
    "bhojpuri","gujarati","punjabi","odia","english"
]

@dataclass
class MovieBlock:
    movie: str
    city: Optional[str]
    details_text: str
    cinemas_reported: Optional[int]
    gross_reported: Optional[int]
    opened_on_dom: Optional[int]

def iter_content_nodes(root: Tag) -> Iterable[Tag]:
    for el in root.descendants:
        if isinstance(el, Tag) and el.name in ("p", "li"):
            txt = el.get_text(" ", strip=True)
            if txt:
                yield el

def extract_bold_chunks(el: Tag) -> List[Tag]:
    return [b for b in el.find_all(["strong", "b"]) if norm_space(b.get_text())]

def _tail_text_until_week_marker(bold_node: Tag) -> str:
    tail = ""
    for sib in bold_node.next_siblings:
        if isinstance(sib, Tag) and sib.name in ("strong", "b"):
            break
        s = sib.get_text(" ", strip=True) if isinstance(sib, Tag) else str(sib)
        if s:
            tail += " " + s
    tail = norm_space(tail)
    mweek = WEEK_MARKER.search(tail)
    return norm_space(tail[:mweek.start()] if mweek else tail)

def _keep_qualifier(q: str) -> bool:
    ql = norm_space(q).lower()
    if not ql:
        return False
    if "opened on" in ql:
        return False
    if re.fullmatch(r'\d+\s*shows?', ql):
        return False

    # keep any bracket text that mentions a language or dubbed
    return bool(re.search(
        r'\b(?:dubbed|telugu|tamil|kannada|malayalam|marathi|bengali|bhojpuri|gujarati|punjabi|odia|english)\b',
        ql,
        flags=re.IGNORECASE
    ))

def merge_title_and_extract_opened_on(bold_node: Tag) -> Tuple[str, Optional[int]]:
    title = norm_space(bold_node.get_text(" ", strip=True))
    # Strip "(N shows)" and "(Hindi)" if embedded in bold title (Hindi-only problem)
    title = SHOWS_PAREN_RE.sub("", title)
    title = HINDI_PAREN_RE.sub("", title)
    title = norm_space(title)

    pre_week_text = _tail_text_until_week_marker(bold_node)

    # Keep all valid bracket qualifiers like:
    # (Tamil), (Telugu Dubbed), (Kannada Dubbed), (Dubbed)
    qualifiers = []
    for m in re.finditer(r'\(([^()]+)\)', pre_week_text):
        seg = m.group(0)
        inner = m.group(1)
        if _keep_qualifier(inner):
            qualifiers.append(seg)

    if qualifiers:
        seen = set()
        deduped = []
        for q in qualifiers:
            key = q.lower()
            if key not in seen:
                seen.add(key)
                deduped.append(q)
        title = f"{title} {' '.join(deduped)}"

    opened_on_dom = None
    m_open = OPENED_ON_RE.search(pre_week_text)
    if m_open:
        try:
            opened_on_dom = int(m_open.group(1))
        except Exception:
            opened_on_dom = None

    return title, opened_on_dom 
def collect_block_text(start_node: Tag) -> str:
    parts = []
    for sib in list(start_node.next_siblings):
        if isinstance(sib, Tag) and sib.name in ("strong", "b"):
            break
        txt = sib.get_text(" ", strip=True) if isinstance(sib, Tag) else str(sib)
        if txt:
            parts.append(txt)
    return norm_space(" ".join(parts))

def infer_reported_totals(details: str) -> Tuple[Optional[int], Optional[int]]:
    txt = norm_space(details)
    m = TOTAL_LINE_RE.search(txt)
    if m:
        ncin = int(m.group("ncin"))
        total = parse_indian_number(m.group("total"))
        return ncin, total
    m2 = re.search(r'([0-9][0-9,]*)\s*\.\s*$', txt)
    total = parse_indian_number(m2.group(1)) if m2 else None
    return None, total

def parse_cinema_entries(details: str) -> List[Dict[str, Optional[int]]]:
    entries = []
    for m in CINEMA_ENTRY_RE.finditer(details):
        cinema = norm_space(m.group("cinema") or "")
        gross = parse_indian_number(m.group("gross"))
        if cinema and gross is not None:
            shows = int(m.group("shows")) if m.group("shows") else None
            entries.append({"cinema": cinema, "shows": shows, "gross": gross})
    return entries

def parse_week_article(html: str) -> List[MovieBlock]:
    root = extract_main_node(html)
    blocks: List[MovieBlock] = []
    current_city: Optional[str] = None

    for node in iter_content_nodes(root):
        txt = node.get_text(" ", strip=True)

        city = is_city_header_text(txt)
        if city:
            current_city = city
            continue

        m_inline = INLINE_CITY_PREFIX.match(txt)
        if m_inline:
            current_city = m_inline.group(1).title()

        bolds = extract_bold_chunks(node)
        if not bolds:
            continue

        for b in bolds:
            movie, opened_on_dom = merge_title_and_extract_opened_on(b)
            details = collect_block_text(b)
            if not details:
                continue

            mt = WEEK_MARKER.search(details)
            details_after_week = details[mt.end():].strip() if mt else details

            ncin, total = infer_reported_totals(details)
            blocks.append(MovieBlock(
                movie=movie,
                city=current_city,
                details_text=details_after_week if mt else details,
                cinemas_reported=ncin,
                gross_reported=total,
                opened_on_dom=opened_on_dom
            ))

    return blocks

# ----------------------------
# Special Hyderabad/Madras split
# ----------------------------
def apply_special_city_splits(blocks: List[MovieBlock]) -> List[MovieBlock]:
    out: List[MovieBlock] = []

    for b in blocks:
        city = (b.city or "").strip()
        city_l = city.lower()

        # Only split for specific parent cities
        if city_l not in (
            "hyderabad",
            "madras",
            "visakhapatnam",
            "vizag",
            "visakapatnam",
        ):
            out.append(b)
            continue

        entries = parse_cinema_entries(b.details_text)
        if not entries:
            out.append(b)
            continue

        # Define split groups
        if city_l == "hyderabad":
            groups = {
                "Nizamabad": ["nizamabad"],
                "Armoor": ["armoor"],
            }

        elif city_l == "madras":
            groups = {
                "Vellore": ["vellore"],
                "Thrissur": ["thrissur"],
                "Salem": ["salem"],
            }

        else:
            # Visakhapatnam / Vizag split-outs
            groups = {
                "Narsipatnam": ["narsipatnam"],
                "Gajuwaka": ["gajuwaka"],
            }

        # Compute sub-city totals
        sub_totals = {k: 0 for k in groups}
        for e in entries:
            name_l = (e.get("cinema") or "").lower()
            gross = e.get("gross") or 0
            for gcity, toks in groups.items():
                if any(tok in name_l for tok in toks):
                    sub_totals[gcity] += gross

        # Emit sub-city rows and deduct from parent city
        total_deduct = 0
        for gcity, gsum in sub_totals.items():
            if gsum > 0:
                out.append(
                    MovieBlock(
                        movie=b.movie,
                        city=gcity,
                        details_text="",
                        cinemas_reported=None,
                        gross_reported=gsum,
                        opened_on_dom=b.opened_on_dom,
                    )
                )
                total_deduct += gsum

        if b.gross_reported is not None and total_deduct > 0:
            remaining = b.gross_reported - total_deduct
            if remaining < 0:
                remaining = 0
            out.append(
                MovieBlock(
                    movie=b.movie,
                    city=b.city,
                    details_text=b.details_text,
                    cinemas_reported=b.cinemas_reported,
                    gross_reported=remaining,
                    opened_on_dom=b.opened_on_dom,
                )
            )
        else:
            out.append(b)

    return out

# ----------------------------
# Discovery/Harvest
# ----------------------------
def discover_weeks(date_from: dt.date, date_to: dt.date) -> List['WeekMeta']:
    metas: List[WeekMeta] = []
    for url, title in collect_week_posts():
        wm = parse_week_from_title(title, url) or parse_week_from_slug(url, title)
        if not wm:
            continue
        if wm.week_start > date_to or wm.week_end < date_from:
            continue
        metas.append(wm)
    # Dedup/sort
    seen = {}
    for w in metas:
        seen[(w.url, w.week_start)] = w
    return sorted(seen.values(), key=lambda x: (x.week_start, x.update_date, x.url))

def normalize_movie_title_for_total(title: str) -> str:
    t = norm_space(title or "")

    # Remove ALL trailing bracket qualifiers (loop until clean)
    while True:
        new_t = re.sub(r'\s*\([^()]+\)\s*$', '', t)
        new_t = norm_space(new_t)
        if new_t == t:
            break
        t = new_t

    return t.lower()

RAW_COLUMNS = [
    "movie",
    "city",
    "cinemas_reported",
    "gross_reported",
    "week_start",
    "week_end",
    "update_date",
    "opened_on_dom",
    "source_url",
]

def harvest_raw(
    date_from: dt.date,
    date_to: dt.date,
    partition_by_week_start: bool = False,
) -> pd.DataFrame:
    """
    Fetch and parse FilmInformation rows only.

    No week numbering, release-year calculation, cumulative calculation,
    wide pivot, or Turso synchronization happens here.

    partition_by_week_start=True is used by parallel GitHub jobs so that
    a collection week crossing Dec/Jan belongs to exactly one partition:
    the partition containing that week's Friday/week_start.
    """
    weeks = discover_weeks(date_from, date_to)

    if partition_by_week_start:
        weeks = [
            wm for wm in weeks
            if date_from <= wm.week_start <= date_to
        ]

    print(
        f"Raw scrape: {len(weeks)} FilmInformation weekly article(s) "
        f"for {date_from} -> {date_to}"
    )

    rows = []

    for idx, wm in enumerate(weeks, start=1):
        print(
            f"[{idx}/{len(weeks)}] "
            f"{wm.week_start} -> {wm.week_end} | {wm.url}"
        )

        html = fetch_html(wm.url)
        blocks = parse_week_article(html)
        blocks = apply_special_city_splits(blocks)

        for b in blocks:
            rows.append({
                "movie": b.movie,
                "city": b.city or "Unknown",
                "cinemas_reported": b.cinemas_reported,
                "gross_reported": b.gross_reported,
                "week_start": wm.week_start,
                "week_end": wm.week_end,
                "update_date": wm.update_date,
                "opened_on_dom": b.opened_on_dom,
                "source_url": wm.url,
            })

    return pd.DataFrame(rows, columns=RAW_COLUMNS)


def finalize_raw(raw_df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply the ORIGINAL full-history business logic to one globally merged
    raw dataframe.

    This is intentionally done only after all parallel scrape partitions
    have been combined. Therefore:
      - week_number is global across the complete history,
      - release_year is based on the true first appearance,
      - cumulative totals span year boundaries correctly,
      - dubbed/base-title movie totals remain global.
    """
    if raw_df is None or raw_df.empty:
        return pd.DataFrame()

    df = raw_df.copy()

    required = {
        "movie",
        "city",
        "cinemas_reported",
        "gross_reported",
        "week_start",
        "week_end",
        "update_date",
        "opened_on_dom",
    }

    missing = required - set(df.columns)
    if missing:
        raise RuntimeError(
            "Raw dataframe is missing required column(s): "
            + ", ".join(sorted(missing))
        )

    # Normalize raw values after CSV artifact round-trips.
    df["movie"] = df["movie"].fillna("").astype(str).map(norm_space)
    df["city"] = df["city"].fillna("Unknown").astype(str).map(norm_space)
    df.loc[df["city"].eq(""), "city"] = "Unknown"

    df["cinemas_reported"] = pd.to_numeric(
        df["cinemas_reported"], errors="coerce"
    )
    df["gross_reported"] = pd.to_numeric(
        df["gross_reported"], errors="coerce"
    )
    df["opened_on_dom"] = pd.to_numeric(
        df["opened_on_dom"], errors="coerce"
    )

    for c in ["week_start", "week_end", "update_date"]:
        df[c] = pd.to_datetime(df[c], errors="coerce").dt.date

    bad_dates = df["week_start"].isna() | df["week_end"].isna()
    if bad_dates.any():
        examples = df.loc[
            bad_dates,
            ["movie", "city", "week_start", "week_end"]
        ].head(10)
        raise RuntimeError(
            "Some merged raw rows contain invalid week dates. Examples:\n"
            + examples.to_string(index=False)
        )

    # Week numbering per movie (unique weeks per movie) — same original logic.
    keys = (
        df[["movie", "week_end"]]
        .drop_duplicates()
        .sort_values(["movie", "week_end"])
    )
    keys["week_number"] = keys.groupby("movie").cumcount() + 1
    df = df.merge(keys, on=["movie", "week_end"], how="left")

    # ------------------------------------------------------------
    # Release year = year of the movie's FIRST appearance
    # Use movie_total_key so language/dubbed versions of the same
    # base title get the same release year.
    # ------------------------------------------------------------
    df["movie_total_key"] = df["movie"].apply(
        normalize_movie_title_for_total
    )

    release_years = (
        df.groupby("movie_total_key", as_index=False)["week_start"]
          .min()
          .rename(columns={"week_start": "first_appearance_week_start"})
    )

    release_years["release_year"] = (
        release_years["first_appearance_week_start"]
        .apply(lambda x: x.year if isinstance(x, dt.date) else pd.NA)
        .astype("Int64")
    )

    df = df.merge(
        release_years[["movie_total_key", "release_year"]],
        on="movie_total_key",
        how="left",
    )

    # Computed fields (×1.18) — same original logic.
    df["adj_gross"] = (
        df["gross_reported"]
        .fillna(0)
        .astype(float)
        .mul(1.18)
        .round()
    )

    df = df.sort_values(
        ["movie", "city", "week_number", "week_end"]
    )

    df["cummulative gross"] = (
        df.groupby(["movie", "city"])["adj_gross"]
          .cumsum()
          .astype("Int64")
    )

    df["total gross"] = (
        df.groupby(["movie", "city"])["adj_gross"]
          .transform("sum")
          .astype("Int64")
    )

    df["movie total gross"] = (
        df.groupby(["movie_total_key"])["adj_gross"]
          .transform("sum")
          .astype("Int64")
    )

    # Normalize dates to strings exactly as the original output expects.
    for c in ["week_start", "week_end", "update_date"]:
        df[c] = pd.to_datetime(
            df[c], errors="coerce"
        ).dt.strftime("%Y-%m-%d")

    return df


def harvest(date_from: dt.date, date_to: dt.date) -> pd.DataFrame:
    """
    Original single-job/full-history behavior retained.

    Existing manual/local commands continue to work exactly through this path.
    """
    raw_df = harvest_raw(
        date_from,
        date_to,
        partition_by_week_start=False,
    )
    return finalize_raw(raw_df)


def load_parallel_raw_parts(raw_dir: str) -> pd.DataFrame:
    """
    Load raw CSV artifacts produced by parallel GitHub jobs.

    Each parallel partition owns weeks by week_start, so year-boundary weeks
    are not intentionally duplicated. source_url is additionally used as a
    safety guard if the same weekly article somehow appears in two artifacts.
    """
    pattern = os.path.join(raw_dir, "*_raw.csv")
    files = sorted(glob.glob(pattern))

    if not files:
        raise RuntimeError(
            f"No *_raw.csv files found in merge directory: {raw_dir}"
        )

    print(f"Merge mode: found {len(files)} raw artifact file(s).")

    frames = []
    seen_source_urls = set()

    for path in files:
        frame = pd.read_csv(path)

        print(
            f"  Reading {os.path.basename(path)}: "
            f"{len(frame)} raw row(s)"
        )

        if frame.empty:
            continue

        if "source_url" in frame.columns:
            frame["source_url"] = (
                frame["source_url"]
                .fillna("")
                .astype(str)
                .map(normalize_url)
            )

            # Remove only whole weekly articles already supplied by an
            # earlier artifact. We do NOT drop duplicate rows within one
            # article, preserving the existing parser/counting behavior.
            duplicate_source_mask = (
                frame["source_url"].ne("")
                & frame["source_url"].isin(seen_source_urls)
            )

            if duplicate_source_mask.any():
                duplicate_urls = sorted(
                    frame.loc[
                        duplicate_source_mask,
                        "source_url",
                    ].unique()
                )
                print(
                    "  Safety de-dup: skipping "
                    f"{len(duplicate_urls)} weekly article(s) "
                    "already supplied by another partition."
                )
                frame = frame.loc[
                    ~frame["source_url"].isin(duplicate_urls)
                ].copy()

            seen_source_urls.update(
                u for u in frame["source_url"].unique()
                if u
            )

        frames.append(frame)

    if not frames:
        return pd.DataFrame()

    merged = pd.concat(
        frames,
        ignore_index=True,
        sort=False,
    )

    print(
        f"Merged raw history: {len(merged)} row(s) "
        f"from {len(frames)} non-empty artifact(s)."
    )

    return merged

# ----------------------------
# Thursday-opening detection from text
# ----------------------------
def date_in_week_from_dom(week_start: dt.date, week_end: dt.date, dom: int) -> Optional[dt.date]:
    d = week_start
    while d <= week_end:
        if d.day == dom:
            return d
        d += dt.timedelta(days=1)
    return None

def build_thursday_flag_from_text(df: pd.DataFrame) -> Dict[str, bool]:
    wstart = pd.to_datetime(df["week_start"], errors="coerce").dt.date
    wend   = pd.to_datetime(df["week_end"], errors="coerce").dt.date
    df_tmp = df.assign(_ws=wstart, _we=wend)

    th_map: Dict[str, bool] = {}
    for movie, g in df_tmp.groupby("movie"):
        first_w = g["week_number"].min()
        g0 = g[g["week_number"] == first_w]
        th = False
        for _, r in g0.iterrows():
            dom = r.get("opened_on_dom")
            try:
                dom = int(dom) if pd.notna(dom) else None
            except Exception:
                dom = None
            if dom is None:
                continue
            ws: dt.date = r["_ws"]
            we: dt.date = r["_we"]
            if not (isinstance(ws, dt.date) and isinstance(we, dt.date)):
                continue
            dd = date_in_week_from_dom(ws, we, dom)
            if dd and dd.weekday() == 3:  # Thursday
                th = True
                break
        th_map[movie.lower()] = th
    return th_map

# ----------------------------
# Wide pivot with Day 1 shift, week cap, and cumulative columns
# ----------------------------
def make_wide(df: pd.DataFrame, thursday_map: Dict[str, bool], max_weeks: int, force_day1_col: bool = True) -> pd.DataFrame:
    base = df.groupby(["movie","city","week_number"], as_index=False)["adj_gross"].sum()

    def col_for_row(row):
        movie_l = row["movie"].lower()
        wn = int(row["week_number"])
        if thursday_map.get(movie_l, False):
            if wn == 1:
                return "Day 1 gross"
            else:
                wk = wn - 1
                if wk > max_weeks:
                    return None
                return f"Week {wk}"
        else:
            if wn > max_weeks:
                return None
            return f"Week {wn}"

    base["colkey"] = base.apply(col_for_row, axis=1)
    base = base[base["colkey"].notna()]

    wide = (
        base.pivot_table(index=["movie","city"], columns="colkey", values="adj_gross", aggfunc="sum")
            .reset_index()
            .rename(columns={"movie":"Movie Title","city":"City"})
    )

    if force_day1_col and "Day 1 gross" not in wide.columns:
        wide["Day 1 gross"] = pd.NA

    week_cols = [c for c in wide.columns if isinstance(c, str) and c.startswith("Week ")]
    week_nums = []
    for c in week_cols:
        try:
            n = int(c.split()[1])
            if 1 <= n <= max_weeks:
                week_nums.append(n)
        except Exception:
            pass
    week_cols = [f"Week {n}" for n in sorted(week_nums)]
    ordered_value_cols = (["Day 1 gross"] if "Day 1 gross" in wide.columns else []) + week_cols

    totals = (
        df.groupby(["movie","city"], as_index=False)["adj_gross"].sum()
          .rename(columns={"movie":"Movie Title","city":"City","adj_gross":"total gross"})
    )
    wide = wide.merge(totals, on=["Movie Title","City"], how="left")

    movie_totals = (
        df.groupby("movie_total_key", as_index=False)["adj_gross"].sum()
          .rename(columns={"adj_gross":"movie total gross"})
    )

    movie_keys = (
        df[["movie", "movie_total_key"]]
          .drop_duplicates()
          .rename(columns={"movie":"Movie Title"})
    )

    wide = wide.merge(movie_keys, on="Movie Title", how="left")
    wide = wide.merge(movie_totals, on="movie_total_key", how="left")

    release_years = (
        df[["movie_total_key", "release_year"]]
          .drop_duplicates(subset=["movie_total_key"])
    )
    wide = wide.merge(release_years, on="movie_total_key", how="left")

    def token_name(col: str) -> str:
        if col == "Day 1 gross":
            return "D1"
        if col.startswith("Week "):
            try:
                return f"W{int(col.split()[1])}"
            except Exception:
                return col
        return col

    cume_cols = []
    running_cols = []
    for col in ordered_value_cols:
        running_cols.append(col)
        label = "Cume " + "+".join(token_name(c) for c in running_cols)
        wide[label] = wide[running_cols].sum(axis=1, skipna=True)
        try:
            wide[label] = wide[label].round().astype("Int64")
        except Exception:
            pass
        cume_cols.append(label)

    wide["Cume total"] = wide["total gross"]

    front = ["Movie Title", "release_year", "City"]
    if "Day 1 gross" in wide.columns:
        front.append("Day 1 gross")
    front += week_cols
    middle = ["total gross", "movie total gross"]
    back = cume_cols + ["Cume total"]

    final_cols = front + middle + back
    for c in wide.columns:
        if c not in final_cols:
            final_cols.append(c)

    wide = wide.reindex(columns=final_cols)

    if "movie_total_key" in wide.columns:
        wide = wide.drop(columns=["movie_total_key"])

    for c in final_cols:
        if c not in {"Movie Title","City"} and c in wide.columns:
            try:
                wide[c] = wide[c].round().astype("Int64")
            except Exception:
                pass

    return wide

# ----------------------------
# Turso publishing
# ----------------------------
def turso_safe_column_name(col: str) -> str:
    # Convert CSV/display column names into stable SQLite/Turso-friendly names.
    c = str(col).strip().lower()
    c = c.replace("+", "_plus_")
    c = re.sub(r"[^a-z0-9_]+", "_", c)
    c = re.sub(r"_+", "_", c).strip("_")
    return c


def validate_sql_identifier(name: str) -> str:
    # Allow only simple SQL identifiers for table/column names.
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name or ""):
        raise ValueError(f"Unsafe SQL identifier: {name!r}")
    return name


def prepare_wide_for_turso(df_wide: pd.DataFrame) -> pd.DataFrame:
    upload_df = df_wide.copy()
    upload_df.columns = [turso_safe_column_name(c) for c in upload_df.columns]

    required = {"movie_title", "release_year", "city"}
    missing = required - set(upload_df.columns)
    if missing:
        raise RuntimeError(
            "Wide dataframe is missing required Turso key column(s): "
            + ", ".join(sorted(missing))
        )

    upload_df["release_year"] = pd.to_numeric(
        upload_df["release_year"], errors="coerce"
    ).astype("Int64")

    if upload_df["release_year"].isna().any():
        bad = upload_df.loc[
            upload_df["release_year"].isna(), ["movie_title", "city"]
        ].head(10)
        raise RuntimeError(
            "Some rows have no release_year. Example rows:\\n"
            + bad.to_string(index=False)
        )

    upload_df["movie_title"] = upload_df["movie_title"].astype(str).str.strip()
    upload_df["city"] = upload_df["city"].astype(str).str.strip()

    upload_df = upload_df.astype(object).where(pd.notna(upload_df), None)
    return upload_df


def sqlite_type_for_series(series: pd.Series) -> str:
    # Choose a SQLite storage class from dataframe values.
    non_null = series.dropna()
    if non_null.empty:
        return "INTEGER"

    if pd.api.types.is_integer_dtype(series.dtype):
        return "INTEGER"
    if pd.api.types.is_float_dtype(series.dtype):
        return "REAL"

    vals = non_null.tolist()
    if all(isinstance(v, (int, bool)) and not isinstance(v, float) for v in vals):
        return "INTEGER"
    if all(isinstance(v, (int, float, bool)) for v in vals):
        return "REAL"

    return "TEXT"


def row_hash_for_turso(row: dict, data_columns: List[str]) -> str:
    # Stable hash lets later runs skip unchanged historical rows.
    import hashlib
    import json

    payload = {c: row.get(c) for c in data_columns}
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def ensure_turso_schema(conn, upload_df: pd.DataFrame, table_name: str) -> None:
    # Create table on first run and add new Week/Cume columns automatically.
    table_name = validate_sql_identifier(table_name)

    column_defs = []
    for col in upload_df.columns:
        safe_col = validate_sql_identifier(col)
        sql_type = sqlite_type_for_series(upload_df[col])

        if safe_col in {"movie_title", "city"}:
            column_defs.append(f'"{safe_col}" TEXT NOT NULL')
        elif safe_col == "release_year":
            column_defs.append(f'"{safe_col}" INTEGER NOT NULL')
        else:
            column_defs.append(f'"{safe_col}" {sql_type}')

    column_defs.append('"row_hash" TEXT')

    create_sql = (
        f'CREATE TABLE IF NOT EXISTS "{table_name}" ('
        + ", ".join(column_defs)
        + ")"
    )
    conn.execute(create_sql)
    conn.commit()

    existing_info = conn.execute(
        f'PRAGMA table_info("{table_name}")'
    ).fetchall()
    existing_cols = {row[1] for row in existing_info}

    for col in upload_df.columns:
        if col in existing_cols:
            continue
        safe_col = validate_sql_identifier(col)
        sql_type = sqlite_type_for_series(upload_df[col])
        conn.execute(
            f'ALTER TABLE "{table_name}" ADD COLUMN "{safe_col}" {sql_type}'
        )

    if "row_hash" not in existing_cols:
        conn.execute(
            f'ALTER TABLE "{table_name}" ADD COLUMN "row_hash" TEXT'
        )

    conn.execute(
        f'CREATE UNIQUE INDEX IF NOT EXISTS '
        f'"{table_name}_movie_year_city_uq" '
        f'ON "{table_name}" ("movie_title", "release_year", "city")'
    )

    conn.execute(
        f'CREATE INDEX IF NOT EXISTS '
        f'"{table_name}_movie_total_idx" '
        f'ON "{table_name}" ("movie_total_gross")'
    )

    conn.execute(
        f'CREATE INDEX IF NOT EXISTS '
        f'"{table_name}_release_year_idx" '
        f'ON "{table_name}" ("release_year")'
    )
    conn.commit()


def publish_wide_to_turso(
    df_wide: pd.DataFrame,
    table_name: str,
    batch_size: int = TURSO_BATCH_SIZE,
) -> None:
    # Synchronize final Movie×City wide data to Turso.
    if not TURSO_DATABASE_URL or not TURSO_AUTH_TOKEN:
        raise RuntimeError(
            "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is not set. "
            "Add both as GitHub Actions repository secrets."
        )

    try:
        import libsql
    except ImportError as exc:
        raise RuntimeError(
            "Python package 'libsql' is missing. "
            "Add libsql to automation/requirements.txt."
        ) from exc

    table_name = validate_sql_identifier(table_name)
    upload_df = prepare_wide_for_turso(df_wide)

    if upload_df.empty:
        print("Turso publish skipped: no wide rows to upload.")
        return

    conn = libsql.connect(
        database=TURSO_DATABASE_URL,
        auth_token=TURSO_AUTH_TOKEN,
    )

    try:
        ensure_turso_schema(conn, upload_df, table_name)

        data_columns = list(upload_df.columns)
        key_columns = ["movie_title", "release_year", "city"]

        new_rows = upload_df.to_dict(orient="records")
        new_by_key = {}

        for row in new_rows:
            key = (
                str(row["movie_title"]),
                int(row["release_year"]),
                str(row["city"]),
            )
            row_hash = row_hash_for_turso(row, data_columns)
            row["row_hash"] = row_hash
            new_by_key[key] = row

        existing_rows = conn.execute(
            f'SELECT "movie_title", "release_year", "city", "row_hash" '
            f'FROM "{table_name}"'
        ).fetchall()

        existing_hash_by_key = {
            (str(r[0]), int(r[1]), str(r[2])): r[3]
            for r in existing_rows
        }

        changed_rows = []
        for key, row in new_by_key.items():
            if existing_hash_by_key.get(key) != row["row_hash"]:
                changed_rows.append(row)

        stale_keys = [
            key for key in existing_hash_by_key
            if key not in new_by_key
        ]

        insert_columns = data_columns + ["row_hash"]
        quoted_cols = ", ".join(f'"{c}"' for c in insert_columns)
        placeholders = ", ".join("?" for _ in insert_columns)

        update_columns = [
            c for c in insert_columns
            if c not in key_columns
        ]
        update_clause = ", ".join(
            f'"{c}" = excluded."{c}"' for c in update_columns
        )

        upsert_sql = (
            f'INSERT INTO "{table_name}" ({quoted_cols}) '
            f'VALUES ({placeholders}) '
            f'ON CONFLICT ("movie_title", "release_year", "city") '
            f'DO UPDATE SET {update_clause}'
        )

        print(
            f"Turso sync: {len(new_by_key)} current rows; "
            f"{len(changed_rows)} new/changed; "
            f"{len(stale_keys)} stale."
        )

        for start in range(0, len(changed_rows), batch_size):
            batch = changed_rows[start:start + batch_size]
            values = [
                tuple(row.get(c) for c in insert_columns)
                for row in batch
            ]
            conn.executemany(upsert_sql, values)
            conn.commit()
            end = min(start + batch_size, len(changed_rows))
            print(f"  Turso: wrote {end}/{len(changed_rows)} changed rows")

        if stale_keys:
            delete_sql = (
                f'DELETE FROM "{table_name}" '
                f'WHERE "movie_title" = ? '
                f'AND "release_year" = ? '
                f'AND "city" = ?'
            )
            for start in range(0, len(stale_keys), batch_size):
                batch = stale_keys[start:start + batch_size]
                conn.executemany(delete_sql, batch)
                conn.commit()

        final_count = conn.execute(
            f'SELECT COUNT(*) FROM "{table_name}"'
        ).fetchone()[0]

        print(
            f"Turso sync completed successfully. "
            f"Live rows in {table_name}: {final_count}"
        )

    finally:
        conn.close()


# ----------------------------
# CLI / main
# ----------------------------
def parse_cli_date(s: str) -> dt.date:
    s = s.strip().lower()
    if s == "today":
        return dt.date.today()
    return dt.date.fromisoformat(s)

def main():
    ap = argparse.ArgumentParser(
        description="FilmInformation Weekly Collections → wide & detail CSVs"
    )

    ap.add_argument(
        "--from",
        dest="date_from",
        default="2021-12-10",
        help="Start date inclusive, YYYY-MM-DD or 'today'",
    )
    ap.add_argument(
        "--to",
        dest="date_to",
        default="today",
        help="End date inclusive, YYYY-MM-DD or 'today'",
    )
    ap.add_argument(
        "--out-dir",
        default=".",
        help="Directory to save outputs",
    )
    ap.add_argument(
        "--out-prefix",
        default="weekly_history",
        help="Output filename prefix (no path)",
    )
    ap.add_argument(
        "--max-weeks",
        type=int,
        default=20,
        help="Maximum number of Week columns to display in the wide sheet (default: 20)",
    )
    ap.add_argument(
        "--turso-table",
        default=TURSO_TABLE,
        help="Turso destination table (default: TURSO_TABLE env var or film_collection_wide)",
    )
    ap.add_argument(
        "--skip-turso",
        action="store_true",
        help="Create CSVs only; do not publish to Turso",
    )

    # --------------------------------------------------------
    # Parallel GitHub Actions modes
    # --------------------------------------------------------
    ap.add_argument(
        "--raw-only",
        action="store_true",
        help=(
            "Scrape only raw FilmInformation rows for the requested "
            "date partition. No week numbering, totals, wide file, or "
            "Turso synchronization is performed."
        ),
    )

    ap.add_argument(
        "--merge-raw-dir",
        default="",
        help=(
            "Directory containing *_raw.csv artifacts from parallel "
            "scrape jobs. Combines all parts, runs the original global "
            "calculations once, creates final CSVs, and optionally syncs Turso."
        ),
    )

    args = ap.parse_args()

    if args.raw_only and args.merge_raw_dir:
        raise RuntimeError(
            "--raw-only and --merge-raw-dir cannot be used together."
        )

    date_from = parse_cli_date(args.date_from)
    date_to = parse_cli_date(args.date_to)

    os.makedirs(args.out_dir, exist_ok=True)

    wide_csv = os.path.join(
        args.out_dir,
        f"{args.out_prefix}_wide_city_movie_totals_weeks.csv",
    )
    detail_csv = os.path.join(
        args.out_dir,
        f"{args.out_prefix}_detail_city_movie_totals_weeks.csv",
    )
    raw_csv = os.path.join(
        args.out_dir,
        f"{args.out_prefix}_raw.csv",
    )

    # ========================================================
    # MODE 1: Parallel scrape partition
    # ========================================================
    if args.raw_only:
        raw_df = harvest_raw(
            date_from,
            date_to,
            partition_by_week_start=True,
        )

        if raw_df.empty:
            print(
                f"No raw data parsed for partition "
                f"{date_from} -> {date_to}."
            )
        else:
            raw_df.to_csv(raw_csv, index=False)

        print("Raw partition completed.")
        print(f"- {raw_csv}")
        print(f"Raw rows: {len(raw_df)}")
        return

    # ========================================================
    # MODE 2: Merge artifacts then run ORIGINAL global logic
    # ========================================================
    if args.merge_raw_dir:
        raw_df = load_parallel_raw_parts(
            args.merge_raw_dir
        )

        if raw_df.empty:
            raise RuntimeError(
                "Parallel raw artifacts were found, but they "
                "contained no usable rows."
            )

        df = finalize_raw(raw_df)

    # ========================================================
    # MODE 3: Original full-history/single-job behavior
    # ========================================================
    else:
        df = harvest(
            date_from,
            date_to,
        )

    if df.empty:
        print("No data parsed in the given range.")
        return

    # --------------------------------------------------------
    # Existing final outputs remain unchanged.
    # --------------------------------------------------------
    df_detail = df.copy()

    df_detail = df_detail[[
        "movie",
        "release_year",
        "city",
        "cinemas_reported",
        "gross_reported",
        "week_start",
        "week_end",
        "update_date",
        "week_number",
        "cummulative gross",
        "total gross",
        "movie total gross",
    ]]

    df_detail.to_csv(
        detail_csv,
        index=False,
    )

    thursday_map = build_thursday_flag_from_text(
        df
    )

    df_wide = make_wide(
        df,
        thursday_map,
        max_weeks=args.max_weeks,
        force_day1_col=True,
    )

    df_wide.to_csv(
        wide_csv,
        index=False,
    )

    # Only this final/global job talks to Turso.
    if not args.skip_turso:
        publish_wide_to_turso(
            df_wide,
            table_name=args.turso_table,
            batch_size=TURSO_BATCH_SIZE,
        )

    print("Wrote:")
    print(f"- {detail_csv}")
    print(f"- {wide_csv}")
    print(
        f"Movie×City groups: {len(df_wide)}; "
        f"rows (detail): {len(df_detail)}"
    )

if __name__ == "__main__":
    main()
