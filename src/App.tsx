import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import Select from "react-select";

interface MovieData {
  movie_title: string;
  city: string;
  state?: string;
  release_year: number;

  day_1_gross?: number | null;
  total_gross?: number | null;
  movie_total_gross?: number | null;

  [key: string]: string | number | null | undefined;
}

interface SelectOption {
  value: string;
  label: string;
}

type ViewMode = "movies" | "dubbed" | "cities";

const API_URL = "/.netlify/functions/boxoffice";
const ITEMS_PER_PAGE = 25;

// ============================================================
// FILM INFORMATION SITE-SPECIFIC CITY / STATION NAMES
//
// These overrides are checked FIRST.
//
// Film Information commonly uses older/trade names such as:
// BOMBAY, NASIK, MANGALORE, KOZHIKODE, etc.
// ============================================================

const FILMINFO_CITY_STATE_MAP: Record<string, string> = {
  // Maharashtra
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

  // Delhi
  DELHI: "Delhi",
  "NEW DELHI": "Delhi",

  // Haryana
  ROHTAK: "Haryana",
  SIRSA: "Haryana",
  GURGAON: "Haryana",
  GURUGRAM: "Haryana",
  FARIDABAD: "Haryana",
  PANIPAT: "Haryana",
  AMBALA: "Haryana",
  KARNAL: "Haryana",
  HISAR: "Haryana",

  // Chandigarh
  CHANDIGARH: "Chandigarh",

  // Punjab
  AMRITSAR: "Punjab",
  LUDHIANA: "Punjab",
  JALANDHAR: "Punjab",
  PATIALA: "Punjab",
  BATHINDA: "Punjab",
  BHATINDA: "Punjab",
  MOHALI: "Punjab",

  // Uttar Pradesh
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

  // Madhya Pradesh
  GWALIOR: "Madhya Pradesh",
  INDORE: "Madhya Pradesh",
  BHOPAL: "Madhya Pradesh",
  JABALPUR: "Madhya Pradesh",
  UJJAIN: "Madhya Pradesh",

  // Rajasthan
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

  // Gujarat
  AHMEDABAD: "Gujarat",
  SURAT: "Gujarat",
  BARODA: "Gujarat",
  VADODARA: "Gujarat",
  RAJKOT: "Gujarat",
  BHAVNAGAR: "Gujarat",
  JAMNAGAR: "Gujarat",
  ANAND: "Gujarat",

  // West Bengal
  CALCUTTA: "West Bengal",
  KOLKATA: "West Bengal",
  HOWRAH: "West Bengal",
  DURGAPUR: "West Bengal",
  ASANSOL: "West Bengal",
  SILIGURI: "West Bengal",

  // Karnataka
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

  // Kerala
  KOZHIKODE: "Kerala",
  CALICUT: "Kerala",
  COCHIN: "Kerala",
  KOCHI: "Kerala",
  TRIVANDRUM: "Kerala",
  THIRUVANANTHAPURAM: "Kerala",
  THRISSUR: "Kerala",
  KOTTAYAM: "Kerala",
  ALAPPUZHA: "Kerala",

  // Tamil Nadu
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

  // Telangana
  HYDERABAD: "Telangana",
  SECUNDERABAD: "Telangana",
  WARANGAL: "Telangana",
  NIZAMABAD: "Telangana",
  ARMOOR: "Telangana",
  KARIMNAGAR: "Telangana",
  KHAMMAM: "Telangana",
  NALGONDA: "Telangana",
  MAHBUBNAGAR: "Telangana",

  // Andhra Pradesh
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

  // Odisha
  BHUBANESWAR: "Odisha",
  BHUBANESHWAR: "Odisha",
  CUTTACK: "Odisha",
  ROURKELA: "Odisha",

  // Bihar
  PATNA: "Bihar",
  GAYA: "Bihar",

  // Jharkhand
  RANCHI: "Jharkhand",
  JAMSHEDPUR: "Jharkhand",
  DHANBAD: "Jharkhand",

  // Chhattisgarh
  RAIPUR: "Chhattisgarh",
  BHILAI: "Chhattisgarh",

  // Assam
  GUWAHATI: "Assam",

  // Uttarakhand
  DEHRADUN: "Uttarakhand",
  HARIDWAR: "Uttarakhand",

  // Jammu & Kashmir
  JAMMU: "Jammu and Kashmir",
  SRINAGAR: "Jammu and Kashmir",

  // Puducherry
  PONDICHERRY: "Puducherry",
  PUDUCHERRY: "Puducherry",
};

// ============================================================
// NORMAL FALLBACK CITY MAP
//
// Used only if the Film Information override does not match.
// ============================================================

const NORMAL_CITY_STATE_MAP: Record<string, string> = {
  anantapur: "Andhra Pradesh",
  bhimavaram: "Andhra Pradesh",
  eluru: "Andhra Pradesh",
  gajuwaka: "Andhra Pradesh",
  guntur: "Andhra Pradesh",
  kadapa: "Andhra Pradesh",
  kakinada: "Andhra Pradesh",
  kurnool: "Andhra Pradesh",
  narsipatnam: "Andhra Pradesh",
  nellore: "Andhra Pradesh",
  ongole: "Andhra Pradesh",
  rajahmundry: "Andhra Pradesh",
  rajamahendravaram: "Andhra Pradesh",
  srikakulam: "Andhra Pradesh",
  tirupati: "Andhra Pradesh",
  vijayawada: "Andhra Pradesh",
  visakhapatnam: "Andhra Pradesh",
  vizag: "Andhra Pradesh",
  vizianagaram: "Andhra Pradesh",

  hyderabad: "Telangana",
  secunderabad: "Telangana",
  nizamabad: "Telangana",
  armoor: "Telangana",
  warangal: "Telangana",
  karimnagar: "Telangana",
  khammam: "Telangana",
  nalgonda: "Telangana",
  mahbubnagar: "Telangana",

  chennai: "Tamil Nadu",
  madras: "Tamil Nadu",
  coimbatore: "Tamil Nadu",
  madurai: "Tamil Nadu",
  salem: "Tamil Nadu",
  vellore: "Tamil Nadu",
  cuddalore: "Tamil Nadu",
  trichy: "Tamil Nadu",
  tiruchirappalli: "Tamil Nadu",
  tirunelveli: "Tamil Nadu",

  bangalore: "Karnataka",
  bengaluru: "Karnataka",
  mangalore: "Karnataka",
  mangaluru: "Karnataka",
  mysore: "Karnataka",
  mysuru: "Karnataka",
  raichur: "Karnataka",
  hubli: "Karnataka",
  hubballi: "Karnataka",
  belgaum: "Karnataka",
  belagavi: "Karnataka",
  bellary: "Karnataka",
  ballari: "Karnataka",
  shimoga: "Karnataka",
  shivamogga: "Karnataka",
  davangere: "Karnataka",

  kochi: "Kerala",
  cochin: "Kerala",
  thrissur: "Kerala",
  kozhikode: "Kerala",
  calicut: "Kerala",
  trivandrum: "Kerala",
  thiruvananthapuram: "Kerala",
  kottayam: "Kerala",
  alappuzha: "Kerala",

  mumbai: "Maharashtra",
  bombay: "Maharashtra",
  pune: "Maharashtra",
  thane: "Maharashtra",
  nagpur: "Maharashtra",
  nashik: "Maharashtra",
  nasik: "Maharashtra",
  kolhapur: "Maharashtra",
  solapur: "Maharashtra",
  aurangabad: "Maharashtra",
  "chhatrapati sambhajinagar": "Maharashtra",

  ahmedabad: "Gujarat",
  surat: "Gujarat",
  vadodara: "Gujarat",
  baroda: "Gujarat",
  rajkot: "Gujarat",
  bhavnagar: "Gujarat",

  kolkata: "West Bengal",
  calcutta: "West Bengal",
  howrah: "West Bengal",
  durgapur: "West Bengal",
  asansol: "West Bengal",

  delhi: "Delhi",
  "new delhi": "Delhi",

  jaipur: "Rajasthan",
  jodhpur: "Rajasthan",
  kota: "Rajasthan",
  udaipur: "Rajasthan",
  ajmer: "Rajasthan",
  bharatpur: "Rajasthan",

  lucknow: "Uttar Pradesh",
  kanpur: "Uttar Pradesh",
  agra: "Uttar Pradesh",
  noida: "Uttar Pradesh",
  ghaziabad: "Uttar Pradesh",
  meerut: "Uttar Pradesh",
  varanasi: "Uttar Pradesh",
  prayagraj: "Uttar Pradesh",
  allahabad: "Uttar Pradesh",

  gwalior: "Madhya Pradesh",
  indore: "Madhya Pradesh",
  bhopal: "Madhya Pradesh",
  jabalpur: "Madhya Pradesh",

  chandigarh: "Chandigarh",

  amritsar: "Punjab",
  ludhiana: "Punjab",
  jalandhar: "Punjab",
  patiala: "Punjab",

  rohtak: "Haryana",
  sirsa: "Haryana",
  gurgaon: "Haryana",
  gurugram: "Haryana",
  faridabad: "Haryana",

  patna: "Bihar",

  ranchi: "Jharkhand",
  jamshedpur: "Jharkhand",
  dhanbad: "Jharkhand",

  bhubaneswar: "Odisha",
  bhubaneshwar: "Odisha",
  cuttack: "Odisha",

  raipur: "Chhattisgarh",
  bhilai: "Chhattisgarh",

  guwahati: "Assam",

  dehradun: "Uttarakhand",

  pondicherry: "Puducherry",
  puducherry: "Puducherry",
};

// ============================================================
// STATE LOOKUP
// ============================================================

const normalizeCity = (city: string) =>
  String(city || "")
    .replace(/\s+/g, " ")
    .trim();

const getStateFromCity = (city: string) => {
  const cleanCity = normalizeCity(city);

  if (!cleanCity) {
    return "Unknown";
  }

  // 1. Film Information exact/trade spelling first
  const siteKey = cleanCity.toUpperCase();

  if (FILMINFO_CITY_STATE_MAP[siteKey]) {
    return FILMINFO_CITY_STATE_MAP[siteKey];
  }

  // 2. Standard fallback
  const normalKey = cleanCity.toLowerCase();

  if (NORMAL_CITY_STATE_MAP[normalKey]) {
    return NORMAL_CITY_STATE_MAP[normalKey];
  }

  return "Unknown";
};

function App() {
  const [data, setData] = useState<MovieData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("movies");

  const [search, setSearch] = useState("");

  const [movies, setMovies] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);

  const [selectedMovies, setSelectedMovies] = useState<SelectOption[]>([]);
  const [selectedCities, setSelectedCities] = useState<SelectOption[]>([]);
  const [selectedStates, setSelectedStates] = useState<SelectOption[]>([]);
  const [selectedYears, setSelectedYears] = useState<SelectOption[]>([]);

  const [page, setPage] = useState(1);

  const [sortColumn, setSortColumn] =
    useState<string>("movie_total_gross");

  const [sortAsc, setSortAsc] = useState(false);

  const toIndianFormat = (num?: number | null) =>
    new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(Number(num || 0));

  const toCrores = (num?: number | null) =>
    `${(Number(num || 0) / 10000000).toFixed(2)} Cr`;

  const getBaseMovieTitle = (title: string) => {
    let base = String(title || "").trim();

    let changed = true;

    while (changed) {
      changed = false;

      const match = base.match(
        /\s*\(([^()]*)\)\s*$/
      );

      if (!match) {
        break;
      }

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
        base = base
          .slice(0, match.index)
          .trim();

        changed = true;
      }
    }

    return base;
  };

  // ============================================================
  // FETCH + ADD STATE IN FRONTEND
  // ============================================================

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(
          `Could not load box office data (${response.status})`
        );
      }

      const result = await response.json();

      const rawRows: MovieData[] = Array.isArray(result)
        ? result
        : result.data || [];

      const rows: MovieData[] = rawRows.map((row) => ({
        ...row,
        state: getStateFromCity(row.city),
      }));

      setData(rows);

      setMovies(
        [
          ...new Set(
            rows
              .map((row) => row.movie_title)
              .filter(Boolean)
          ),
        ].sort()
      );

      setCities(
        [
          ...new Set(
            rows
              .map((row) => row.city)
              .filter(Boolean)
          ),
        ].sort()
      );

      setStates(
        [
          ...new Set(
            rows
              .map((row) => row.state)
              .filter(
                (state): state is string =>
                  Boolean(state) &&
                  state !== "Unknown"
              )
          ),
        ].sort()
      );

      setYears(
        [
          ...new Set(
            rows
              .map((row) => Number(row.release_year))
              .filter(
                (year) =>
                  !Number.isNaN(year)
              )
          ),
        ].sort((a, b) => b - a)
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not load box office data."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ============================================================
  // WEEK COLUMNS
  // ============================================================

  const weekColumns = useMemo(() => {
    const cols = new Set<string>();

    data.forEach((row) => {
      Object.keys(row).forEach((key) => {
        const match = key.match(/^week_(\d+)$/);

        if (!match) {
          return;
        }

        const week = Number(match[1]);

        if (week >= 1 && week <= 20) {
          cols.add(key);
        }
      });
    });

    return [...cols].sort(
      (a, b) =>
        Number(a.replace("week_", "")) -
        Number(b.replace("week_", ""))
    );
  }, [data]);

  // ============================================================
  // CUMULATIVE COLUMN NAMES
  // ============================================================

  const cumulativeColumns = useMemo(() => {
    const cols = new Set<string>();

    data.forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (
          key.startsWith("cume_") &&
          key !== "cume_total"
        ) {
          cols.add(key);
        }
      });
    });

    const depth = (key: string) => {
      if (key === "cume_d1") {
        return 0;
      }

      const matches = key.match(/_plus_w\d+/g);

      return matches
        ? matches.length
        : 0;
    };

    return [...cols].sort(
      (a, b) =>
        depth(a) - depth(b)
    );
  }, [data]);

  // ============================================================
  // UNIVERSAL TOTAL
  // ============================================================

  const calculateWeeklyTotal = (
    row: MovieData
  ) => {
    let total =
      Number(
        row.day_1_gross || 0
      );

    weekColumns.forEach((column) => {
      total +=
        Number(
          row[column] || 0
        );
    });

    return total;
  };

  // ============================================================
  // REBUILD CUMULATIVE
  // ============================================================

  const rebuildProgression = (
    source: MovieData
  ): MovieData => {
    const row: MovieData = {
      ...source,
    };

    const day1 =
      Number(
        row.day_1_gross || 0
      );

    let running =
      day1;

    cumulativeColumns.forEach(
      (
        column,
        index
      ) => {
        if (index === 0) {
          row[column] = day1;
          return;
        }

        const weekColumn =
          weekColumns[
            index - 1
          ];

        if (weekColumn) {
          running +=
            Number(
              row[
                weekColumn
              ] || 0
            );
        }

        row[column] =
          running;
      }
    );

    row.movie_total_gross =
      calculateWeeklyTotal(row);

    return row;
  };

  const formatColumnName = (
    column: string
  ) => {
    if (column === "movie_title") return "Movie";
    if (column === "city") return "City";
    if (column === "state") return "State";
    if (column === "release_year") return "Release Year";
    if (column === "movie_total_gross") return "Movie Total Gross";
    if (column === "total_gross") return "City Total Gross";
    if (column === "day_1_gross") return "Day 1";

    if (column.startsWith("week_")) {
      return `Week ${column.replace(
        "week_",
        ""
      )}`;
    }

    if (column.startsWith("cume_")) {
      const label =
        column
          .replace("cume_", "")
          .replaceAll("_plus_", "+")
          .replaceAll("_", " ")
          .toUpperCase();

      return `Cume ${label}`;
    }

    return column;
  };

  // ============================================================
  // FILTERING
  // ============================================================

  const filteredRawData = useMemo(() => {
    const searchText =
      search
        .toLowerCase()
        .trim();

    return data.filter((row) => {
      if (
        selectedMovies.length > 0
      ) {
        const rowBase =
          getBaseMovieTitle(
            row.movie_title
          ).toLowerCase();

        const matched =
          selectedMovies.some(
            (item) =>
              getBaseMovieTitle(
                item.value
              ).toLowerCase() ===
              rowBase
          );

        if (!matched) {
          return false;
        }
      }

      if (
        selectedCities.length > 0 &&
        !selectedCities.some(
          (item) =>
            item.value === row.city
        )
      ) {
        return false;
      }

      if (
        selectedStates.length > 0 &&
        !selectedStates.some(
          (item) =>
            item.value === row.state
        )
      ) {
        return false;
      }

      if (
        selectedYears.length > 0 &&
        !selectedYears.some(
          (item) =>
            Number(item.value) ===
            Number(row.release_year)
        )
      ) {
        return false;
      }

      if (searchText) {
        const combined = [
          row.movie_title,
          getBaseMovieTitle(row.movie_title),
          row.city,
          row.state,
          row.release_year,
        ]
          .join(" ")
          .toLowerCase();

        if (
          !combined.includes(
            searchText
          )
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    data,
    search,
    selectedMovies,
    selectedCities,
    selectedStates,
    selectedYears,
  ]);

  // ============================================================
  // CITY DATA
  // ============================================================

  const cityData = useMemo(() => {
    return filteredRawData.map(
      (rawRow) => {
        const rebuilt =
          rebuildProgression(
            rawRow
          );

        rebuilt.total_gross =
          rebuilt.movie_total_gross;

        return rebuilt;
      }
    );
  }, [
    filteredRawData,
    weekColumns,
    cumulativeColumns,
  ]);

  // ============================================================
  // DUBBED / EXACT VERSION
  // ============================================================

  const dubbedData = useMemo(() => {
    const groups =
      new Map<
        string,
        MovieData
      >();

    filteredRawData.forEach((row) => {
      const key =
        `${row.movie_title}__${row.release_year}`;

      if (!groups.has(key)) {
        const initial: MovieData = {
          movie_title:
            row.movie_title,
          city: "",
          state: "",
          release_year:
            Number(
              row.release_year
            ),
          day_1_gross: 0,
          movie_total_gross: 0,
        };

        weekColumns.forEach((column) => {
          initial[column] = 0;
        });

        groups.set(key, initial);
      }

      const group =
        groups.get(key)!;

      group.day_1_gross =
        Number(
          group.day_1_gross || 0
        ) +
        Number(
          row.day_1_gross || 0
        );

      weekColumns.forEach((column) => {
        group[column] =
          Number(
            group[column] || 0
          ) +
          Number(
            row[column] || 0
          );
      });
    });

    return [
      ...groups.values(),
    ].map(
      rebuildProgression
    );
  }, [
    filteredRawData,
    weekColumns,
    cumulativeColumns,
  ]);

  // ============================================================
  // BASE MOVIE TOTALS
  // ============================================================

  const movieTotals = useMemo(() => {
    const groups =
      new Map<
        string,
        MovieData
      >();

    dubbedData.forEach(
      (
        versionRow
      ) => {
        const baseTitle =
          getBaseMovieTitle(
            versionRow.movie_title
          );

        const key =
          `${baseTitle}__${versionRow.release_year}`;

        if (!groups.has(key)) {
          const initial: MovieData = {
            movie_title:
              baseTitle,
            city: "",
            state: "",
            release_year:
              Number(
                versionRow.release_year
              ),
            day_1_gross: 0,
            movie_total_gross: 0,
          };

          weekColumns.forEach((column) => {
            initial[column] = 0;
          });

          groups.set(
            key,
            initial
          );
        }

        const group =
          groups.get(key)!;

        group.day_1_gross =
          Number(
            group.day_1_gross || 0
          ) +
          Number(
            versionRow.day_1_gross || 0
          );

        weekColumns.forEach((column) => {
          group[column] =
            Number(
              group[column] || 0
            ) +
            Number(
              versionRow[column] || 0
            );
        });
      }
    );

    return [
      ...groups.values(),
    ].map(
      rebuildProgression
    );
  }, [
    dubbedData,
    weekColumns,
    cumulativeColumns,
  ]);

  // ============================================================
  // ACTIVE DATA
  // ============================================================

  const activeData =
    viewMode === "movies"
      ? movieTotals
      : viewMode === "dubbed"
      ? dubbedData
      : cityData;

  // ============================================================
  // SORT
  // ============================================================

  const sortedData = useMemo(() => {
    const rows = [
      ...activeData,
    ];

    rows.sort((a, b) => {
      const aValue =
        a[sortColumn];

      const bValue =
        b[sortColumn];

      if (
        typeof aValue === "string" ||
        typeof bValue === "string"
      ) {
        const first =
          String(
            aValue || ""
          );

        const second =
          String(
            bValue || ""
          );

        return sortAsc
          ? first.localeCompare(second)
          : second.localeCompare(first);
      }

      const first =
        Number(
          aValue || 0
        );

      const second =
        Number(
          bValue || 0
        );

      return sortAsc
        ? first - second
        : second - first;
    });

    return rows;
  }, [
    activeData,
    sortColumn,
    sortAsc,
  ]);

  const handleSort = (
    column: string
  ) => {
    if (
      sortColumn === column
    ) {
      setSortAsc(
        (old) => !old
      );
    } else {
      setSortColumn(column);

      if (
        column === "movie_title" ||
        column === "city" ||
        column === "state"
      ) {
        setSortAsc(true);
      } else {
        setSortAsc(false);
      }
    }

    setPage(1);
  };

  const changeView = (
    mode: ViewMode
  ) => {
    setViewMode(mode);

    if (mode === "cities") {
      setSortColumn(
        "total_gross"
      );
    } else {
      setSortColumn(
        "movie_total_gross"
      );
    }

    setSortAsc(false);
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedMovies,
    selectedCities,
    selectedStates,
    selectedYears,
  ]);

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        sortedData.length /
          ITEMS_PER_PAGE
      )
    );

  const paginatedData =
    sortedData.slice(
      (page - 1) *
        ITEMS_PER_PAGE,
      page *
        ITEMS_PER_PAGE
    );

  // ============================================================
  // KPI
  // ============================================================

  const grandMovieTotal =
    useMemo(
      () =>
        movieTotals.reduce(
          (
            sum,
            row
          ) =>
            sum +
            Number(
              row.movie_total_gross ||
                0
            ),
          0
        ),
      [
        movieTotals,
      ]
    );

  if (loading) {
    return (
      <div className="App">
        <h1>🎬 BoxOfficeTrack</h1>
        <div className="spinner" />
        <p style={{ textAlign: "center" }}>
          Loading box office data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <h1>🎬 BoxOfficeTrack</h1>

        <p style={{ color: "red" }}>
          {error}
        </p>

        <button onClick={fetchData}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="App">

      <h1>🎬 BoxOfficeTrack</h1>

      <input
        type="text"
        className="search-input"
        placeholder="Search movie / city / state / release year..."
        value={search}
        onChange={(e) =>
          setSearch(
            e.target.value
          )
        }
      />

      {/* FILTERS */}

      <div className="filters">

        <Select
          isMulti
          options={movies.map((movie) => ({
            value: movie,
            label: movie,
          }))}
          value={selectedMovies}
          onChange={(value) =>
            setSelectedMovies(
              value as SelectOption[]
            )
          }
          placeholder="Select Movie(s)"
        />

        <Select
          isMulti
          options={cities.map((city) => ({
            value: city,
            label: city,
          }))}
          value={selectedCities}
          onChange={(value) =>
            setSelectedCities(
              value as SelectOption[]
            )
          }
          placeholder="Select City/Cities"
        />

        <Select
          isMulti
          options={states.map((state) => ({
            value: state,
            label: state,
          }))}
          value={selectedStates}
          onChange={(value) =>
            setSelectedStates(
              value as SelectOption[]
            )
          }
          placeholder="Select State(s)"
        />

        <Select
          isMulti
          options={years.map((year) => ({
            value: String(year),
            label: String(year),
          }))}
          value={selectedYears}
          onChange={(value) =>
            setSelectedYears(
              value as SelectOption[]
            )
          }
          placeholder="Release Year"
        />

      </div>

      {/* KPI */}

      <div className="kpi-container">

        <div className="kpi-card">
          <h3>Movie Total Gross</h3>
          <p>
            ₹{toIndianFormat(
              grandMovieTotal
            )}
          </p>
          <small>
            ₹{toCrores(
              grandMovieTotal
            )}
          </small>
        </div>

        <div className="kpi-card">
          <h3>Base Movies</h3>
          <p>{movieTotals.length}</p>
        </div>

        <div className="kpi-card">
          <h3>Versions</h3>
          <p>{dubbedData.length}</p>
        </div>

        <div className="kpi-card">
          <h3>Movie × City Records</h3>
          <p>{cityData.length}</p>
        </div>

      </div>

      {/* TABS */}

      <div className="view-tabs">

        <button
          className={
            viewMode === "movies"
              ? "view-tab active"
              : "view-tab"
          }
          onClick={() =>
            changeView(
              "movies"
            )
          }
        >
          Movie Totals
        </button>

        <button
          className={
            viewMode === "dubbed"
              ? "view-tab active"
              : "view-tab"
          }
          onClick={() =>
            changeView(
              "dubbed"
            )
          }
        >
          Dubbed
        </button>

        <button
          className={
            viewMode === "cities"
              ? "view-tab active"
              : "view-tab"
          }
          onClick={() =>
            changeView(
              "cities"
            )
          }
        >
          City Breakdown
        </button>

      </div>

      <h2 style={{ textAlign: "center" }}>
        {viewMode === "movies"
          ? "Movie Total Collections"
          : viewMode === "dubbed"
          ? "Movie Version / Dubbed Collections"
          : "Movie × City Collections"}
      </h2>

      {/* MOVIE / DUBBED */}

      {(viewMode === "movies" ||
        viewMode === "dubbed") && (
        <div className="table-scroll">

          <table>

            <thead>
              <tr>

                <th
                  onClick={() =>
                    handleSort(
                      "movie_title"
                    )
                  }
                >
                  Movie
                </th>

                <th
                  onClick={() =>
                    handleSort(
                      "release_year"
                    )
                  }
                >
                  Release Year
                </th>

                <th
                  className="movie-total-column"
                  onClick={() =>
                    handleSort(
                      "movie_total_gross"
                    )
                  }
                >
                  Movie Total Gross
                </th>

                {cumulativeColumns.map(
                  (
                    column
                  ) => (
                    <th
                      key={column}
                      onClick={() =>
                        handleSort(
                          column
                        )
                      }
                    >
                      {formatColumnName(
                        column
                      )}
                    </th>
                  )
                )}

                <th
                  onClick={() =>
                    handleSort(
                      "day_1_gross"
                    )
                  }
                >
                  Day 1
                </th>

                {weekColumns.map(
                  (
                    column
                  ) => (
                    <th
                      key={column}
                      onClick={() =>
                        handleSort(
                          column
                        )
                      }
                    >
                      {formatColumnName(
                        column
                      )}
                    </th>
                  )
                )}

              </tr>
            </thead>

            <tbody>

              {paginatedData.map(
                (
                  row
                ) => (
                  <tr
                    key={`${row.movie_title}-${row.release_year}`}
                  >

                    <td className="movie-cell">
                      {
                        row.movie_title
                      }
                    </td>

                    <td>
                      {
                        row.release_year
                      }
                    </td>

                    <td className="movie-total-column">
                      ₹
                      {toIndianFormat(
                        Number(
                          row.movie_total_gross ||
                            0
                        )
                      )}
                    </td>

                    {cumulativeColumns.map(
                      (
                        column
                      ) => (
                        <td
                          key={column}
                        >
                          ₹
                          {toIndianFormat(
                            Number(
                              row[column] ||
                                0
                            )
                          )}
                        </td>
                      )
                    )}

                    <td>
                      ₹
                      {toIndianFormat(
                        Number(
                          row.day_1_gross ||
                            0
                        )
                      )}
                    </td>

                    {weekColumns.map(
                      (
                        column
                      ) => (
                        <td
                          key={column}
                        >
                          ₹
                          {toIndianFormat(
                            Number(
                              row[column] ||
                                0
                            )
                          )}
                        </td>
                      )
                    )}

                  </tr>
                )
              )}

            </tbody>

          </table>

        </div>
      )}

      {/* CITY */}

      {viewMode === "cities" && (
        <div className="table-scroll">

          <table>

            <thead>
              <tr>

                <th
                  onClick={() =>
                    handleSort(
                      "movie_title"
                    )
                  }
                >
                  Movie
                </th>

                <th
                  onClick={() =>
                    handleSort(
                      "city"
                    )
                  }
                >
                  City
                </th>

                <th
                  onClick={() =>
                    handleSort(
                      "state"
                    )
                  }
                >
                  State
                </th>

                <th
                  onClick={() =>
                    handleSort(
                      "release_year"
                    )
                  }
                >
                  Release Year
                </th>

                <th
                  className="total-gross-column"
                  onClick={() =>
                    handleSort(
                      "total_gross"
                    )
                  }
                >
                  City Total Gross
                </th>

                {cumulativeColumns.map(
                  (
                    column
                  ) => (
                    <th
                      key={column}
                      onClick={() =>
                        handleSort(
                          column
                        )
                      }
                    >
                      {formatColumnName(
                        column
                      )}
                    </th>
                  )
                )}

                <th
                  onClick={() =>
                    handleSort(
                      "day_1_gross"
                    )
                  }
                >
                  Day 1
                </th>

                {weekColumns.map(
                  (
                    column
                  ) => (
                    <th
                      key={column}
                      onClick={() =>
                        handleSort(
                          column
                        )
                      }
                    >
                      {formatColumnName(
                        column
                      )}
                    </th>
                  )
                )}

              </tr>
            </thead>

            <tbody>

              {paginatedData.map(
                (
                  row,
                  index
                ) => (
                  <tr
                    key={`${row.movie_title}-${row.city}-${row.release_year}-${index}`}
                  >

                    <td className="movie-cell">
                      {
                        row.movie_title
                      }
                    </td>

                    <td>
                      {
                        row.city
                      }
                    </td>

                    <td>
                      {
                        row.state ||
                        "Unknown"
                      }
                    </td>

                    <td>
                      {
                        row.release_year
                      }
                    </td>

                    <td className="total-gross-column">
                      ₹
                      {toIndianFormat(
                        Number(
                          row.total_gross ||
                            0
                        )
                      )}
                    </td>

                    {cumulativeColumns.map(
                      (
                        column
                      ) => (
                        <td
                          key={column}
                        >
                          ₹
                          {toIndianFormat(
                            Number(
                              row[column] ||
                                0
                            )
                          )}
                        </td>
                      )
                    )}

                    <td>
                      ₹
                      {toIndianFormat(
                        Number(
                          row.day_1_gross ||
                            0
                        )
                      )}
                    </td>

                    {weekColumns.map(
                      (
                        column
                      ) => (
                        <td
                          key={column}
                        >
                          ₹
                          {toIndianFormat(
                            Number(
                              row[column] ||
                                0
                            )
                          )}
                        </td>
                      )
                    )}

                  </tr>
                )
              )}

            </tbody>

          </table>

        </div>
      )}

      {/* PAGINATION */}

      {totalPages > 1 && (
        <div className="pagination">

          <button
            disabled={page === 1}
            onClick={() =>
              setPage(
                (old) =>
                  Math.max(
                    old - 1,
                    1
                  )
              )
            }
          >
            Prev
          </button>

          <span>
            Page {page} of{" "}
            {totalPages}
            {" — "}
            {sortedData.length} records
          </span>

          <button
            disabled={
              page >= totalPages
            }
            onClick={() =>
              setPage(
                (old) =>
                  Math.min(
                    old + 1,
                    totalPages
                  )
              )
            }
          >
            Next
          </button>

        </div>
      )}

    </div>
  );
}

export default App;
