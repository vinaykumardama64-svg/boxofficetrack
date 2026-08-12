import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import Select from "react-select";

interface MovieData {
  movie_title: string;
  city: string;
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

type ViewMode = "movies" | "cities";

const API_URL = "/.netlify/functions/boxoffice";
const ITEMS_PER_PAGE = 25;

function App() {
  const [data, setData] = useState<MovieData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<ViewMode>("movies");

  const [search, setSearch] = useState("");

  const [movies, setMovies] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);

  const [selectedMovies, setSelectedMovies] = useState<SelectOption[]>([]);
  const [selectedCities, setSelectedCities] = useState<SelectOption[]>([]);
  const [selectedYears, setSelectedYears] = useState<SelectOption[]>([]);

  const [page, setPage] = useState(1);

  const [sortColumn, setSortColumn] =
    useState<string>("movie_total_gross");

  const [sortAsc, setSortAsc] = useState(false);

  // ------------------------------------------------------------
  // Formatting
  // ------------------------------------------------------------

  const toIndianFormat = (num?: number | null) =>
    new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(Number(num || 0));

  const toCrores = (num?: number | null) =>
    `${(Number(num || 0) / 10000000).toFixed(2)} Cr`;

  // ------------------------------------------------------------
  // Load data
  // ------------------------------------------------------------

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

      const rows: MovieData[] = Array.isArray(result)
        ? result
        : result.data || [];

      setData(rows);

      setMovies(
        [...new Set(rows.map((r) => r.movie_title).filter(Boolean))].sort()
      );

      setCities(
        [...new Set(rows.map((r) => r.city).filter(Boolean))].sort()
      );

      setYears(
        [
          ...new Set(
            rows
              .map((r) => Number(r.release_year))
              .filter((y) => !Number.isNaN(y))
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

  // ------------------------------------------------------------
  // Dynamic Week columns
  // ------------------------------------------------------------

  const weekColumns = useMemo(() => {
    const cols = new Set<string>();

    data.forEach((row) => {
      Object.keys(row).forEach((key) => {
        const match = key.match(/^week_(\d+)$/);

        if (!match) return;

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

  // ------------------------------------------------------------
  // Dynamic cumulative columns
  // ------------------------------------------------------------

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
      if (key === "cume_d1") return 0;

      const weeks = key.match(/_plus_w\d+/g);

      return weeks ? weeks.length : 0;
    };

    return [...cols].sort(
      (a, b) => depth(a) - depth(b)
    );
  }, [data]);

  // ------------------------------------------------------------
  // Column label
  // ------------------------------------------------------------

  const formatColumnName = (column: string) => {
    if (column === "movie_title") return "Movie";
    if (column === "city") return "City";
    if (column === "release_year") return "Release Year";

    if (column === "movie_total_gross") {
      return "Movie Total Gross";
    }

    if (column === "total_gross") {
      return "City Total Gross";
    }

    if (column === "day_1_gross") {
      return "Day 1";
    }

    if (column.startsWith("week_")) {
      return `Week ${column.replace("week_", "")}`;
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

  // ------------------------------------------------------------
  // Base filtering
  // ------------------------------------------------------------

  const filteredCityData = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    return data.filter((row) => {
      if (
        selectedMovies.length &&
        !selectedMovies.some(
          (x) => x.value === row.movie_title
        )
      ) {
        return false;
      }

      if (
        selectedCities.length &&
        !selectedCities.some(
          (x) => x.value === row.city
        )
      ) {
        return false;
      }

      if (
        selectedYears.length &&
        !selectedYears.some(
          (x) =>
            Number(x.value) ===
            Number(row.release_year)
        )
      ) {
        return false;
      }

      if (searchText) {
        const searchable = [
          row.movie_title,
          row.city,
          row.release_year,
        ]
          .join(" ")
          .toLowerCase();

        if (!searchable.includes(searchText)) {
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
    selectedYears,
  ]);

  // ------------------------------------------------------------
  // MOVIE AGGREGATION
  //
  // One row = one Movie + Release Year
  //
  // IMPORTANT:
  // movie_total_gross is already the movie-level total.
  // Do NOT sum the repeated city value.
  //
  // Day / Week / Cume values ARE summed across cities.
  // ------------------------------------------------------------

  const movieAggregatedData = useMemo(() => {
    const groups = new Map<string, MovieData>();

    filteredCityData.forEach((row) => {
      const key =
        `${row.movie_title}__${row.release_year}`;

      if (!groups.has(key)) {
        const initial: MovieData = {
          movie_title: row.movie_title,
          city: "",
          release_year: Number(row.release_year),
          movie_total_gross:
            Number(row.movie_total_gross || 0),
          day_1_gross: 0,
        };

        cumulativeColumns.forEach((col) => {
          initial[col] = 0;
        });

        weekColumns.forEach((col) => {
          initial[col] = 0;
        });

        groups.set(key, initial);
      }

      const movie = groups.get(key)!;

      /*
        movie_total_gross repeats for every city.
        Keep the largest/single movie total instead of adding.
      */

      movie.movie_total_gross = Math.max(
        Number(movie.movie_total_gross || 0),
        Number(row.movie_total_gross || 0)
      );

      movie.day_1_gross =
        Number(movie.day_1_gross || 0) +
        Number(row.day_1_gross || 0);

      cumulativeColumns.forEach((column) => {
        movie[column] =
          Number(movie[column] || 0) +
          Number(row[column] || 0);
      });

      weekColumns.forEach((column) => {
        movie[column] =
          Number(movie[column] || 0) +
          Number(row[column] || 0);
      });
    });

    return [...groups.values()];
  }, [
    filteredCityData,
    cumulativeColumns,
    weekColumns,
  ]);

  // ------------------------------------------------------------
  // Dataset used by active tab
  // ------------------------------------------------------------

  const activeData =
    viewMode === "movies"
      ? movieAggregatedData
      : filteredCityData;

  // ------------------------------------------------------------
  // GLOBAL SORT
  //
  // Sort entire active dataset.
  // Pagination happens AFTER this.
  // ------------------------------------------------------------

  const sortedData = useMemo(() => {
    const rows = [...activeData];

    rows.sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (
        typeof aValue === "string" ||
        typeof bValue === "string"
      ) {
        const first = String(aValue || "");
        const second = String(bValue || "");

        return sortAsc
          ? first.localeCompare(second)
          : second.localeCompare(first);
      }

      const first = Number(aValue || 0);
      const second = Number(bValue || 0);

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

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortAsc((old) => !old);
    } else {
      setSortColumn(column);

      if (
        column === "movie_title" ||
        column === "city"
      ) {
        setSortAsc(true);
      } else {
        setSortAsc(false);
      }
    }

    setPage(1);
  };

  // ------------------------------------------------------------
  // Change view
  // ------------------------------------------------------------

  const changeView = (mode: ViewMode) => {
    setViewMode(mode);

    setSortColumn("movie_total_gross");
    setSortAsc(false);
    setPage(1);
  };

  // ------------------------------------------------------------
  // Reset pagination on filters
  // ------------------------------------------------------------

  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedMovies,
    selectedCities,
    selectedYears,
  ]);

  // ------------------------------------------------------------
  // Pagination
  // ------------------------------------------------------------

  const totalPages = Math.max(
    1,
    Math.ceil(
      sortedData.length / ITEMS_PER_PAGE
    )
  );

  const paginatedData = sortedData.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  // ------------------------------------------------------------
  // KPI total
  // ------------------------------------------------------------

  const allMovieGross = useMemo(
    () =>
      movieAggregatedData.reduce(
        (sum, movie) =>
          sum +
          Number(
            movie.movie_total_gross || 0
          ),
        0
      ),
    [movieAggregatedData]
  );

  // ------------------------------------------------------------
  // Loading / error
  // ------------------------------------------------------------

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

      {/* Search */}

      <input
        type="text"
        className="search-input"
        placeholder="Search movie / city / release year..."
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
      />

      {/* Filters */}

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
            ₹{toIndianFormat(allMovieGross)}
          </p>

          <small>
            ₹{toCrores(allMovieGross)}
          </small>
        </div>

        <div className="kpi-card">
          <h3>Movies</h3>

          <p>
            {movieAggregatedData.length}
          </p>
        </div>

        <div className="kpi-card">
          <h3>Movie × City Records</h3>

          <p>
            {filteredCityData.length}
          </p>
        </div>

      </div>

      {/* --------------------------------------------------------
          Tabs
      --------------------------------------------------------- */}

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "10px",
          margin: "2rem 0 1rem",
        }}
      >

        <button
          onClick={() =>
            changeView("movies")
          }
          style={{
            padding: "10px 22px",
            borderRadius: "6px",
            border: "1px solid #1976d2",
            cursor: "pointer",
            background:
              viewMode === "movies"
                ? "#1976d2"
                : "#ffffff",
            color:
              viewMode === "movies"
                ? "#ffffff"
                : "#1976d2",
            fontWeight: 600,
          }}
        >
          Movie Totals
        </button>

        <button
          onClick={() =>
            changeView("cities")
          }
          style={{
            padding: "10px 22px",
            borderRadius: "6px",
            border: "1px solid #1976d2",
            cursor: "pointer",
            background:
              viewMode === "cities"
                ? "#1976d2"
                : "#ffffff",
            color:
              viewMode === "cities"
                ? "#ffffff"
                : "#1976d2",
            fontWeight: 600,
          }}
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
          : "Movie × City Collections"}
      </h2>

      {/* --------------------------------------------------------
          MOVIE TOTALS TABLE
      --------------------------------------------------------- */}

      {viewMode === "movies" && (
        <div
          className="table-scroll"
          style={{
            overflowX: "auto",
          }}
        >
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
                        handleSort(column)
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
                        handleSort(column)
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
                (row) => (
                  <tr
                    key={`${row.movie_title}-${row.release_year}`}
                  >

                    <td className="movie-cell">
                      {row.movie_title}
                    </td>

                    <td>
                      {row.release_year}
                    </td>

                    <td
                      style={{
                        fontWeight: 700,
                      }}
                    >
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
                        <td key={column}>
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
                        <td key={column}>
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

      {/* --------------------------------------------------------
          CITY BREAKDOWN TABLE
      --------------------------------------------------------- */}

      {viewMode === "cities" && (
        <div
          className="table-scroll"
          style={{
            overflowX: "auto",
          }}
        >
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
                    handleSort("city")
                  }
                >
                  City
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
                        handleSort(column)
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
                        handleSort(column)
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
                      "total_gross"
                    )
                  }
                >
                  City Total Gross
                </th>

              </tr>
            </thead>

            <tbody>

              {paginatedData.map(
                (row, index) => (
                  <tr
                    key={`${row.movie_title}-${row.city}-${row.release_year}-${index}`}
                  >

                    <td className="movie-cell">
                      {row.movie_title}
                    </td>

                    <td>
                      {row.city}
                    </td>

                    <td>
                      {row.release_year}
                    </td>

                    <td>
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
                        <td key={column}>
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
                        <td key={column}>
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
                          row.total_gross ||
                            0
                        )
                      )}
                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>
        </div>
      )}

      {/* --------------------------------------------------------
          Pagination
      --------------------------------------------------------- */}

      {totalPages > 1 && (
        <div className="pagination">

          <button
            disabled={page === 1}
            onClick={() =>
              setPage((old) =>
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
            Page {page} of {totalPages}
            {" — "}
            {sortedData.length} records
          </span>

          <button
            disabled={
              page >= totalPages
            }
            onClick={() =>
              setPage((old) =>
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
