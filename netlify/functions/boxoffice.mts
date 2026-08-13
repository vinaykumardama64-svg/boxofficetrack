import { connect } from "@tursodatabase/serverless";

type Row = Record<string, any>;

const TABLE = "film_collection_wide";
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const FILMINFO_CITY_STATE_MAP: Record<string, string> = {
  BOMBAY: "Maharashtra",
  MUMBAI: "Maharashtra",
  KOLHAPUR: "Maharashtra",
  NASIK: "Maharashtra",
  NASHIK: "Maharashtra",
  PUNE: "Maharashtra",
  THANE: "Maharashtra",
  NAGPUR: "Maharashtra",
  AURANGABAD: "Maharashtra",
  "CHHATRAPATI SAMBHAJINAGAR": "Maharashtra",
  PANDHARPUR: "Maharashtra",
  SOLAPUR: "Maharashtra",
  AMRAVATI: "Maharashtra",
  AKOLA: "Maharashtra",
  JALGAON: "Maharashtra",
  LATUR: "Maharashtra",
  SANGLI: "Maharashtra",
  SATARA: "Maharashtra",

  DELHI: "Delhi",
  "NEW DELHI": "Delhi",

  ROHTAK: "Haryana",
  SIRSA: "Haryana",
  GURGAON: "Haryana",
  GURUGRAM: "Haryana",
  FARIDABAD: "Haryana",
  PANIPAT: "Haryana",
  AMBALA: "Haryana",
  KARNAL: "Haryana",
  HISAR: "Haryana",

  CHANDIGARH: "Chandigarh",

  AMRITSAR: "Punjab",
  LUDHIANA: "Punjab",
  JALANDHAR: "Punjab",
  PATIALA: "Punjab",
  BATHINDA: "Punjab",
  BHATINDA: "Punjab",
  MOHALI: "Punjab",

  AGRA: "Uttar Pradesh",
  ALLAHABAD: "Uttar Pradesh",
  PRAYAGRAJ: "Uttar Pradesh",
  BAREILLY: "Uttar Pradesh",
  GHAZIABAD: "Uttar Pradesh",
  KANPUR: "Uttar Pradesh",
  LUCKNOW: "Uttar Pradesh",
  MEERUT: "Uttar Pradesh",
  NOIDA: "Uttar Pradesh",
  VARANASI: "Uttar Pradesh",
  GORAKHPUR: "Uttar Pradesh",
  ALIGARH: "Uttar Pradesh",
  MORADABAD: "Uttar Pradesh",

  GWALIOR: "Madhya Pradesh",
  INDORE: "Madhya Pradesh",
  BHOPAL: "Madhya Pradesh",
  JABALPUR: "Madhya Pradesh",
  UJJAIN: "Madhya Pradesh",

  JODHPUR: "Rajasthan",
  BHARATPUR: "Rajasthan",
  AJMER: "Rajasthan",
  JAIPUR: "Rajasthan",
  KOTA: "Rajasthan",
  UDAIPUR: "Rajasthan",
  BEHROR: "Rajasthan",
  JHUNJHUNU: "Rajasthan",
  BIKANER: "Rajasthan",
  ALWAR: "Rajasthan",
  SIKAR: "Rajasthan",

  AHMEDABAD: "Gujarat",
  SURAT: "Gujarat",
  BARODA: "Gujarat",
  VADODARA: "Gujarat",
  RAJKOT: "Gujarat",
  BHAVNAGAR: "Gujarat",
  JAMNAGAR: "Gujarat",
  ANAND: "Gujarat",

  CALCUTTA: "West Bengal",
  KOLKATA: "West Bengal",
  HOWRAH: "West Bengal",
  DURGAPUR: "West Bengal",
  ASANSOL: "West Bengal",
  SILIGURI: "West Bengal",

  BANGALORE: "Karnataka",
  BENGALURU: "Karnataka",
  MANGALORE: "Karnataka",
  MANGALURU: "Karnataka",
  MYSORE: "Karnataka",
  MYSURU: "Karnataka",
  RAICHUR: "Karnataka",
  HUBLI: "Karnataka",
  HUBBALLI: "Karnataka",
  BELGAUM: "Karnataka",
  BELAGAVI: "Karnataka",
  BELLARY: "Karnataka",
  BALLARI: "Karnataka",
  SHIMOGA: "Karnataka",
  SHIVAMOGGA: "Karnataka",
  DAVANGERE: "Karnataka",
  DHARWAD: "Karnataka",
  GULBARGA: "Karnataka",

  KOZHIKODE: "Kerala",
  CALICUT: "Kerala",
  COCHIN: "Kerala",
  KOCHI: "Kerala",
  TRIVANDRUM: "Kerala",
  THIRUVANANTHAPURAM: "Kerala",
  THRISSUR: "Kerala",
  KOTTAYAM: "Kerala",
  ALAPPUZHA: "Kerala",

  MADRAS: "Tamil Nadu",
  CHENNAI: "Tamil Nadu",
  COIMBATORE: "Tamil Nadu",
  MADURAI: "Tamil Nadu",
  SALEM: "Tamil Nadu",
  VELLORE: "Tamil Nadu",
  CUDDALORE: "Tamil Nadu",
  TRICHY: "Tamil Nadu",
  TIRUCHIRAPPALLI: "Tamil Nadu",
  TIRUNELVELI: "Tamil Nadu",

  HYDERABAD: "Telangana",
  SECUNDERABAD: "Telangana",
  WARANGAL: "Telangana",
  NIZAMABAD: "Telangana",
  ARMOOR: "Telangana",
  KARIMNAGAR: "Telangana",
  KHAMMAM: "Telangana",
  NALGONDA: "Telangana",
  MAHBUBNAGAR: "Telangana",

  VIJAYAWADA: "Andhra Pradesh",
  VISAKHAPATNAM: "Andhra Pradesh",
  VIZAG: "Andhra Pradesh",
  GAJUWAKA: "Andhra Pradesh",
  NARSIPATNAM: "Andhra Pradesh",
  GUNTUR: "Andhra Pradesh",
  TIRUPATI: "Andhra Pradesh",
  NELLORE: "Andhra Pradesh",
  KURNOOL: "Andhra Pradesh",
  KADAPA: "Andhra Pradesh",
  CUDDAPAH: "Andhra Pradesh",
  KAKINADA: "Andhra Pradesh",
  RAJAHMUNDRY: "Andhra Pradesh",
  RAJAMAHENDRAVARAM: "Andhra Pradesh",
  VIZIANAGARAM: "Andhra Pradesh",
  SRIKAKULAM: "Andhra Pradesh",
  BHIMAVARAM: "Andhra Pradesh",
  ELURU: "Andhra Pradesh",
  ONGOLE: "Andhra Pradesh",
MACHILIPATNAM: "Andhra Pradesh",

  BHUBANESWAR: "Odisha",
  BHUBANESHWAR: "Odisha",
  CUTTACK: "Odisha",
  ROURKELA: "Odisha",

  PATNA: "Bihar",
  GAYA: "Bihar",

  RANCHI: "Jharkhand",
  JAMSHEDPUR: "Jharkhand",
  DHANBAD: "Jharkhand",

  RAIPUR: "Chhattisgarh",
  BHILAI: "Chhattisgarh",

  GUWAHATI: "Assam",

  DEHRADUN: "Uttarakhand",
  HARIDWAR: "Uttarakhand",

  JAMMU: "Jammu and Kashmir",
  SRINAGAR: "Jammu and Kashmir",

  PONDICHERRY: "Puducherry",
  PUDUCHERRY: "Puducherry",

  GOA: "Goa",
};

const NORMAL_CITY_STATE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(FILMINFO_CITY_STATE_MAP).map(([city, state]) => [
    city.toLowerCase(),
    state,
  ])
);

function normalizeCity(city: unknown): string {
  return String(city || "").replace(/\s+/g, " ").trim();
}

function getStateFromCity(city: unknown): string {
  const cleanCity = normalizeCity(city);
  if (!cleanCity) return "Unknown";

  const exact = FILMINFO_CITY_STATE_MAP[cleanCity.toUpperCase()];
  if (exact) return exact;

  return NORMAL_CITY_STATE_MAP[cleanCity.toLowerCase()] || "Unknown";
}

function getBaseMovieTitle(title: unknown): string {
  let base = String(title || "").trim();
  let changed = true;

  while (changed) {
    changed = false;

    const match = base.match(/\s*\(([^()]*)\)\s*$/);
    if (!match) break;

    const qualifier = String(match[1] || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/\s+/g, " ")
      .trim();

    const isVersionQualifier =
      /dubbed|revived|re[\s-]?release|r\s*r|telugu|tamil|kannada|malayalam|hindi|marathi|bengali|punjabi|odia|bhojpuri|english/.test(
        qualifier
      );

    if (isVersionQualifier) {
      base = base.slice(0, match.index).trim();
      changed = true;
    }
  }

  return base;
}

function safeNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function parseCsvParam(url: URL, name: string): string[] {
  const raw = url.searchParams.get(name);
  if (!raw) return [];

  return raw
    .split("|")
    .map((x) => decodeURIComponent(x).trim())
    .filter(Boolean);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function rebuildProgression(row: Row, weekColumns: string[]): Row {
  const out: Row = { ...row };
  const day1 = safeNumber(out.day_1_gross);

  let running = day1;
  out.cume_d1 = running;

  weekColumns.forEach((column, index) => {
    running += safeNumber(out[column]);

    const tokens = ["cume_d1"];
    for (let i = 1; i <= index + 1; i++) {
      tokens.push(`w${i}`);
    }

    out[tokens.join("_plus_")] = running;
  });

  out.movie_total_gross = running;
  out.total_gross = running;
  out.cume_total = running;

  return out;
}

function sortRows(rows: Row[], sortColumn: string, sortAsc: boolean): Row[] {
  return [...rows].sort((a, b) => {
    const av = a[sortColumn];
    const bv = b[sortColumn];

    const aNum = Number(av);
    const bNum = Number(bv);

    const bothNumeric =
      Number.isFinite(aNum) &&
      Number.isFinite(bNum) &&
      av !== "" &&
      bv !== "";

    if (bothNumeric) {
      return sortAsc ? aNum - bNum : bNum - aNum;
    }

    const as = String(av ?? "");
    const bs = String(bv ?? "");

    return sortAsc ? as.localeCompare(bs) : bs.localeCompare(as);
  });
}

function paginate(rows: Row[], page: number, limit: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * limit;

  return {
    rows: rows.slice(start, start + limit),
    pagination: {
      page: safePage,
      limit,
      total,
      totalPages,
      hasMore: safePage < totalPages,
    },
  };
}

export default async (request: Request) => {
  try {
    const databaseUrl = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!databaseUrl) {
      throw new Error("TURSO_DATABASE_URL is missing");
    }

    if (!authToken) {
      throw new Error("TURSO_AUTH_TOKEN is missing");
    }

    const db = connect({
      url: databaseUrl,
      authToken,
    });

    const requestUrl = new URL(request.url);
    const view = requestUrl.searchParams.get("view") || "movies";

    const page = Math.max(
      1,
      Math.floor(Number(requestUrl.searchParams.get("page") || "1"))
    );

    const requestedLimit = Math.floor(
      Number(requestUrl.searchParams.get("limit") || String(DEFAULT_LIMIT))
    );

    const limit = Math.min(
      Math.max(1, requestedLimit || DEFAULT_LIMIT),
      MAX_LIMIT
    );

    const sortColumn =
      requestUrl.searchParams.get("sort") ||
      (view === "cities" ? "total_gross" : "movie_total_gross");

    const sortAsc =
      requestUrl.searchParams.get("dir") === "asc";

    const search = (
      requestUrl.searchParams.get("search") || ""
    )
      .trim()
      .toLowerCase();

    const selectedMovies = parseCsvParam(requestUrl, "movies");
    const selectedCities = parseCsvParam(requestUrl, "cities");
    const selectedStates = parseCsvParam(requestUrl, "states");
    const selectedYears = parseCsvParam(requestUrl, "years").map(Number);

    const pragmaRows = await db.prepare(
      `PRAGMA table_info("${TABLE}")`
    ).all();

    const dbColumns = (pragmaRows as any[])
      .map((r: any) => String(r.name ?? r[1] ?? ""))
      .filter(Boolean);

    const weekColumns = dbColumns
      .filter((c) => /^week_\d+$/.test(c))
      .sort(
        (a, b) =>
          Number(a.replace("week_", "")) -
          Number(b.replace("week_", ""))
      );

    // ========================================================
    // FILTER OPTIONS
    // ========================================================

    if (view === "filters") {
      const rows = await db.prepare(`
        SELECT DISTINCT movie_title, city, release_year
        FROM "${TABLE}"
      `).all();

      const dataRows = rows as any[];

      const movies = uniqueSorted(
        dataRows.map((r) => String(r.movie_title ?? ""))
      );

      const cities = uniqueSorted(
        dataRows.map((r) => String(r.city ?? ""))
      );

      const states = uniqueSorted(
        cities.map((city) => getStateFromCity(city))
      ).sort((a, b) => {
        if (a === "Unknown") return 1;
        if (b === "Unknown") return -1;
        return a.localeCompare(b);
      });

      const years = [
        ...new Set(
          dataRows
            .map((r) => Number(r.release_year))
            .filter((y) => Number.isFinite(y))
        ),
      ].sort((a, b) => b - a);

      return json({
        movies,
        cities,
        states,
        years,
      });
    }

    // ========================================================
    // Build lightweight WHERE clause for raw DB filters.
    // Movie/state are translated to exact movie/city values first.
    // ========================================================

    let allowedMovieTitles: string[] = [];

    if (selectedMovies.length > 0) {
      const wantedBases = new Set(
        selectedMovies.map((m) => getBaseMovieTitle(m).toLowerCase())
      );

      const titleRows = await db.prepare(`
        SELECT DISTINCT movie_title
        FROM "${TABLE}"
      `).all();

      allowedMovieTitles = (titleRows as any[])
        .map((r) => String(r.movie_title ?? ""))
        .filter((title) =>
          wantedBases.has(getBaseMovieTitle(title).toLowerCase())
        );
    }

    let allowedStateCities: string[] = [];

    if (selectedStates.length > 0) {
      const cityRows = await db.prepare(`
        SELECT DISTINCT city
        FROM "${TABLE}"
      `).all();

      allowedStateCities = (cityRows as any[])
        .map((r) => String(r.city ?? ""))
        .filter((city) => selectedStates.includes(getStateFromCity(city)));
    }

    const whereParts: string[] = [];
    const params: any[] = [];

    if (allowedMovieTitles.length > 0) {
      whereParts.push(
        `"movie_title" IN (${allowedMovieTitles.map(() => "?").join(",")})`
      );
      params.push(...allowedMovieTitles);
    } else if (selectedMovies.length > 0) {
      whereParts.push("1 = 0");
    }

    if (selectedCities.length > 0) {
      whereParts.push(
        `"city" IN (${selectedCities.map(() => "?").join(",")})`
      );
      params.push(...selectedCities);
    }

    if (allowedStateCities.length > 0) {
      whereParts.push(
        `"city" IN (${allowedStateCities.map(() => "?").join(",")})`
      );
      params.push(...allowedStateCities);
    } else if (selectedStates.length > 0) {
      whereParts.push("1 = 0");
    }

    if (selectedYears.length > 0) {
      whereParts.push(
        `"release_year" IN (${selectedYears.map(() => "?").join(",")})`
      );
      params.push(...selectedYears);
    }

    const whereSql =
      whereParts.length > 0
        ? `WHERE ${whereParts.join(" AND ")}`
        : "";

    const aggregateSelect = [
      `"movie_title"`,
      `"release_year"`,
      `SUM(COALESCE("day_1_gross", 0)) AS "day_1_gross"`,
      ...weekColumns.map(
        (c) => `SUM(COALESCE("${c}", 0)) AS "${c}"`
      ),
    ].join(", ");

    // ========================================================
    // Exact-version aggregation.
    // This reduces potentially 2L+ city rows to only title/version rows.
    // ========================================================

    const exactVersionRows = await db.prepare(`
      SELECT ${aggregateSelect}
      FROM "${TABLE}"
      ${whereSql}
      GROUP BY "movie_title", "release_year"
    `).all(params);

    let versions: Row[] = (exactVersionRows as any[]).map((row) =>
      rebuildProgression(
        {
          ...row,
          movie_title: String(row.movie_title ?? ""),
          release_year: Number(row.release_year ?? 0),
          city: "",
          state: "",
        },
        weekColumns
      )
    );

    if (search) {
      versions = versions.filter((row) => {
        const combined = [
          row.movie_title,
          getBaseMovieTitle(row.movie_title),
          row.release_year,
        ]
          .join(" ")
          .toLowerCase();

        return combined.includes(search);
      });
    }

    // ========================================================
    // Base movie aggregation.
    // Done in the function after Turso has already compressed raw rows
    // to exact-version rows, so this remains small even with 2L+ rows.
    // ========================================================

    const baseMap = new Map<string, Row>();

    for (const row of versions) {
      const baseTitle = getBaseMovieTitle(row.movie_title);
      const key = `${baseTitle}__${row.release_year}`;

      if (!baseMap.has(key)) {
        const initial: Row = {
          movie_title: baseTitle,
          city: "",
          state: "",
          release_year: row.release_year,
          day_1_gross: 0,
        };

        weekColumns.forEach((c) => {
          initial[c] = 0;
        });

        baseMap.set(key, initial);
      }

      const group = baseMap.get(key)!;

      group.day_1_gross =
        safeNumber(group.day_1_gross) +
        safeNumber(row.day_1_gross);

      weekColumns.forEach((c) => {
        group[c] =
          safeNumber(group[c]) +
          safeNumber(row[c]);
      });
    }

    let movies = [...baseMap.values()].map((row) =>
      rebuildProgression(row, weekColumns)
    );

    if (search) {
      movies = movies.filter((row) => {
        const combined = [
          row.movie_title,
          row.release_year,
        ]
          .join(" ")
          .toLowerCase();

        return combined.includes(search);
      });
    }

    // ========================================================
    // Filter-aware KPI values
    // ========================================================

    const grandMovieTotal = movies.reduce(
      (sum, row) => sum + safeNumber(row.movie_total_gross),
      0
    );

    const cityCountStmt = db.prepare(`
      SELECT COUNT(*) AS total
      FROM "${TABLE}"
      ${whereSql}
    `);

    const cityCountRow = await cityCountStmt.get(params);
    const cityRecordCount = Number(
      (cityCountRow as any)?.total ?? 0
    );

    const stats = {
      grandMovieTotal,
      baseMovies: movies.length,
      versions: versions.length,
      cityRecords: cityRecordCount,
    };

    // ========================================================
    // MOVIE TOTALS
    // ========================================================

    if (view === "movies") {
      const sorted = sortRows(
        movies,
        sortColumn,
        sortAsc
      );

      const result = paginate(
        sorted,
        page,
        limit
      );

      return json({
        data: result.rows,
        pagination: result.pagination,
        stats,
        weekColumns,
      });
    }

    // ========================================================
    // DUBBED / EXACT VERSION
    // ========================================================

    if (view === "dubbed") {
      const sorted = sortRows(
        versions,
        sortColumn,
        sortAsc
      );

      const result = paginate(
        sorted,
        page,
        limit
      );

      return json({
        data: result.rows,
        pagination: result.pagination,
        stats,
        weekColumns,
      });
    }

    // ========================================================
    // CITY BREAKDOWN
    //
    // IMPORTANT:
    // Sorting/filtering happens in SQL BEFORE LIMIT/OFFSET.
    // The browser receives only the current page even if Turso
    // eventually contains 2L+ rows.
    // ========================================================

    if (view === "cities") {
      const cityWhereParts = [...whereParts];
      const cityParams = [...params];

      // Build a SQL CASE expression for the frontend-only State field.
      // City/state values here come only from our hard-coded map.
      const stateCaseParts = Object.entries(FILMINFO_CITY_STATE_MAP).map(
        ([city, state]) => {
          const safeCity = city.replace(/'/g, "''");
          const safeState = state.replace(/'/g, "''");
          return `WHEN UPPER(TRIM("city")) = '${safeCity}' THEN '${safeState}'`;
        }
      );

      const stateCaseSql = `
        CASE
          ${stateCaseParts.join("\n          ")}
          ELSE 'Unknown'
        END
      `;

      if (search) {
        cityWhereParts.push(
          `(
            LOWER("movie_title") LIKE ?
            OR LOWER("city") LIKE ?
            OR LOWER(${stateCaseSql}) LIKE ?
            OR CAST("release_year" AS TEXT) LIKE ?
          )`
        );

        const like = `%${search}%`;
        cityParams.push(
          like,
          like,
          like,
          like
        );
      }

      const cityWhereSql =
        cityWhereParts.length > 0
          ? `WHERE ${cityWhereParts.join(" AND ")}`
          : "";

      const allowedSortColumns = new Set([
        "movie_title",
        "city",
        "state",
        "release_year",
        "total_gross",
        "movie_total_gross",
        "day_1_gross",
        "cume_total",
        ...weekColumns,
        ...dbColumns.filter((c) =>
          /^cume_/.test(c)
        ),
      ]);

      const citySortColumn = allowedSortColumns.has(sortColumn)
        ? sortColumn
        : "total_gross";

      const orderExpression =
        citySortColumn === "state"
          ? stateCaseSql
          : `"${citySortColumn}"`;

      const cityCountResult = await db.prepare(`
        SELECT COUNT(*) AS total
        FROM "${TABLE}"
        ${cityWhereSql}
      `).get(cityParams);

      const cityTotal = Number(
        (cityCountResult as any)?.total ?? 0
      );

      const cityTotalPages = Math.max(
        1,
        Math.ceil(cityTotal / limit)
      );

      const safeCityPage = Math.min(
        Math.max(1, page),
        cityTotalPages
      );

      const cityOffset =
        (safeCityPage - 1) * limit;

      const cityRows = await db.prepare(`
        SELECT
          *,
          ${stateCaseSql} AS "state"
        FROM "${TABLE}"
        ${cityWhereSql}
        ORDER BY ${orderExpression} ${sortAsc ? "ASC" : "DESC"},
                 "movie_title" ASC,
                 "city" ASC
        LIMIT ?
        OFFSET ?
      `).all([
        ...cityParams,
        limit,
        cityOffset,
      ]);

      const pageRows: Row[] = (cityRows as any[]).map((row) => {
        // Preserve the current UI rule:
        // City Total Gross = Day1 + Week1 ... WeekN.
        const rebuilt = rebuildProgression(
          {
            ...row,
            movie_title: String(row.movie_title ?? ""),
            city: String(row.city ?? ""),
            state: String(row.state ?? getStateFromCity(row.city)),
            release_year: Number(row.release_year ?? 0),
          },
          weekColumns
        );

        rebuilt.total_gross =
          rebuilt.movie_total_gross;

        return rebuilt;
      });

      return json({
        data: pageRows,
        pagination: {
          page: safeCityPage,
          limit,
          total: cityTotal,
          totalPages: cityTotalPages,
          hasMore: safeCityPage < cityTotalPages,
        },
        stats: {
          ...stats,
          cityRecords: cityTotal,
        },
        weekColumns,
      });
    }

    return json(
      {
        error: `Unsupported view: ${view}`,
      },
      400
    );
  } catch (error) {
    console.error("BOXOFFICE_FUNCTION_ERROR:", error);

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      500
    );
  }
};
