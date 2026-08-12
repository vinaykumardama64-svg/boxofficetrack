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

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface StatsInfo {
  grandMovieTotal: number;
  baseMovies: number;
  versions: number;
  cityRecords: number;
}

type ViewMode = "movies" | "dubbed" | "cities";

const API_URL = "/.netlify/functions/boxoffice";
const ITEMS_PER_PAGE = 25;

function App() {
  const [rows, setRows] = useState<MovieData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("movies");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

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

  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 1,
    hasMore: false,
  });

  const [stats, setStats] = useState<StatsInfo>({
    grandMovieTotal: 0,
    baseMovies: 0,
    versions: 0,
    cityRecords: 0,
  });

  const [weekColumns, setWeekColumns] = useState<string[]>([]);

  // ============================================================
  // Formatting
  // ============================================================

  const toIndianFormat = (num?: number | null) =>
    new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(Number(num || 0));

  const toCrores = (num?: number | null) =>
    `${(Number(num || 0) / 10000000).toFixed(2)} Cr`;

  // ============================================================
  // Search debounce
  // ============================================================

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [search]);

  // ============================================================
  // Filter options
  // ============================================================

  const fetchFilters = async () => {
    try {
      setFiltersLoading(true);

      const response = await fetch(
        `${API_URL}?view=filters`
      );

      if (!response.ok) {
        throw new Error(
          `Could not load filters (${response.status})`
        );
      }

      const result = await response.json();

      setMovies(result.movies || []);
      setCities(result.cities || []);
      setStates(result.states || []);
      setYears(result.years || []);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not load filters."
      );
    } finally {
      setFiltersLoading(false);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  // ============================================================
  // Build API URL
  // ============================================================

  const buildDataUrl = () => {
    const params = new URLSearchParams();

    params.set("view", viewMode);
    params.set("page", String(page));
    params.set("limit", String(ITEMS_PER_PAGE));
    params.set("sort", sortColumn);
    params.set("dir", sortAsc ? "asc" : "desc");

    if (debouncedSearch) {
      params.set(
        "search",
        debouncedSearch
      );
    }

    if (selectedMovies.length > 0) {
      params.set(
        "movies",
        selectedMovies
          .map((item) =>
            encodeURIComponent(item.value)
          )
          .join("|")
      );
    }

    if (selectedCities.length > 0) {
      params.set(
        "cities",
        selectedCities
          .map((item) =>
            encodeURIComponent(item.value)
          )
          .join("|")
      );
    }

    if (selectedStates.length > 0) {
      params.set(
        "states",
        selectedStates
          .map((item) =>
            encodeURIComponent(item.value)
          )
          .join("|")
      );
    }

    if (selectedYears.length > 0) {
      params.set(
        "years",
        selectedYears
          .map((item) =>
            encodeURIComponent(item.value)
          )
          .join("|")
      );
    }

    return `${API_URL}?${params.toString()}`;
  };

  // ============================================================
  // Fetch only the active tab/page
  // ============================================================

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
  buildDataUrl(),
  {
    cache: "no-store",
  }
);

      if (!response.ok) {
        throw new Error(
          `Could not load box office data (${response.status})`
        );
      }

      const result = await response.json();

      setRows(
        Array.isArray(result.data)
          ? result.data
          : []
      );

      if (result.pagination) {
        setPagination({
          page: Number(result.pagination.page || 1),
          limit: Number(
            result.pagination.limit ||
              ITEMS_PER_PAGE
          ),
          total: Number(result.pagination.total || 0),
          totalPages: Math.max(
            1,
            Number(
              result.pagination.totalPages || 1
            )
          ),
          hasMore: Boolean(
            result.pagination.hasMore
          ),
        });
      }

      if (result.stats) {
        setStats({
          grandMovieTotal: Number(
            result.stats.grandMovieTotal || 0
          ),
          baseMovies: Number(
            result.stats.baseMovies || 0
          ),
          versions: Number(
            result.stats.versions || 0
          ),
          cityRecords: Number(
            result.stats.cityRecords || 0
          ),
        });
      }

      if (Array.isArray(result.weekColumns)) {
        setWeekColumns(
          result.weekColumns
        );
      }
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
  }, [
    viewMode,
    page,
    sortColumn,
    sortAsc,
    debouncedSearch,
    selectedMovies,
    selectedCities,
    selectedStates,
    selectedYears,
  ]);

  // ============================================================
  // Cumulative columns derived from available week columns
  // ============================================================

  const cumulativeColumns = useMemo(() => {
    const cols: string[] = [];

    cols.push("cume_d1");

    weekColumns.forEach((_, index) => {
      const tokens = ["cume_d1"];

      for (let i = 1; i <= index + 1; i++) {
        tokens.push(`w${i}`);
      }

      cols.push(
        tokens.join("_plus_")
      );
    });

    return cols;
  }, [weekColumns]);

  // ============================================================
  // Labels
  // ============================================================

  const formatColumnName = (
    column: string
  ) => {
    if (column === "movie_title") {
      return "Movie";
    }

    if (column === "city") {
      return "City";
    }

    if (column === "state") {
      return "State";
    }

    if (column === "release_year") {
      return "Release Year";
    }

    if (
      column === "movie_total_gross"
    ) {
      return "Movie Total Gross";
    }

    if (column === "total_gross") {
      return "City Total Gross";
    }

    if (column === "day_1_gross") {
      return "Day 1";
    }

    if (column.startsWith("week_")) {
      return `Week ${column.replace(
        "week_",
        ""
      )}`;
    }

    if (column.startsWith("cume_")) {
      const label = column
        .replace("cume_", "")
        .replaceAll("_plus_", "+")
        .replaceAll("_", " ")
        .toUpperCase();

      return `Cume ${label}`;
    }

    return column;
  };

  // ============================================================
  // Sort
  // ============================================================

  const handleSort = (
    column: string
  ) => {
    if (sortColumn === column) {
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

  // ============================================================
  // Tab change
  // ============================================================

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

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1);
  }, [
    selectedMovies,
    selectedCities,
    selectedStates,
    selectedYears,
  ]);

  // ============================================================
  // Loading/error
  // ============================================================

  if (
    loading &&
    rows.length === 0
  ) {
    return (
      <div className="App">
        <h1>🎬 BoxOfficeTrack</h1>

        <div className="spinner" />

        <p
          style={{
            textAlign: "center",
          }}
        >
          Loading box office data...
        </p>
      </div>
    );
  }

  if (
    error &&
    rows.length === 0
  ) {
    return (
      <div className="App">
        <h1>🎬 BoxOfficeTrack</h1>

        <p
          style={{
            color: "red",
          }}
        >
          {error}
        </p>

        <button
          onClick={() => {
            fetchFilters();
            fetchData();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="App">

      <h1>
        🎬 BoxOfficeTrack
      </h1>

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
          isLoading={filtersLoading}
          options={movies.map(
            (movie) => ({
              value: movie,
              label: movie,
            })
          )}
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
          isLoading={filtersLoading}
          options={cities.map(
            (city) => ({
              value: city,
              label: city,
            })
          )}
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
          isLoading={filtersLoading}
          options={states.map(
            (state) => ({
              value: state,
              label: state,
            })
          )}
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
          isLoading={filtersLoading}
          options={years.map(
            (year) => ({
              value: String(year),
              label: String(year),
            })
          )}
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
          <h3>
            Movie Total Gross
          </h3>

          <p>
            ₹
            {toIndianFormat(
              stats.grandMovieTotal
            )}
          </p>

          <small>
            ₹
            {toCrores(
              stats.grandMovieTotal
            )}
          </small>
        </div>

        <div className="kpi-card">
          <h3>Base Movies</h3>
          <p>
            {stats.baseMovies}
          </p>
        </div>

        <div className="kpi-card">
          <h3>Versions</h3>
          <p>
            {stats.versions}
          </p>
        </div>

        <div className="kpi-card">
          <h3>
            Movie × City Records
          </h3>
          <p>
            {stats.cityRecords}
          </p>
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
            changeView("movies")
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
            changeView("dubbed")
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
            changeView("cities")
          }
        >
          City Breakdown
        </button>

      </div>

      <h2
        style={{
          textAlign: "center",
        }}
      >
        {viewMode === "movies"
          ? "Movie Total Collections"
          : viewMode === "dubbed"
          ? "Movie Version / Dubbed Collections"
          : "Movie × City Collections"}
      </h2>

      {loading && (
        <p
          style={{
            textAlign: "center",
            opacity: 0.7,
          }}
        >
          Updating results...
        </p>
      )}

      {error && (
        <p
          style={{
            color: "red",
            textAlign: "center",
          }}
        >
          {error}
        </p>
      )}

      {/* MOVIE TOTALS / DUBBED */}

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
                  (column) => (
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
                  (column) => (
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

              {rows.map(
                (row) => (
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
                      (column) => (
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
                      (column) => (
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

      {/* CITY BREAKDOWN */}

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
                  (column) => (
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
                  (column) => (
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

              {rows.map(
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
                      (column) => (
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
                      (column) => (
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

      {pagination.totalPages > 1 && (
        <div className="pagination">

          <button
            disabled={
              page <= 1 ||
              loading
            }
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
            Page {pagination.page} of{" "}
            {pagination.totalPages}
            {" — "}
            {pagination.total} records
          </span>

          <button
            disabled={
              page >=
                pagination.totalPages ||
              loading
            }
            onClick={() =>
              setPage(
                (old) =>
                  Math.min(
                    old + 1,
                    pagination.totalPages
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
