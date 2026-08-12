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

const API_URL = "/.netlify/functions/boxoffice";

function App() {
  const [data, setData] = useState<MovieData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [movies, setMovies] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);

  const [selectedMovies, setSelectedMovies] = useState<SelectOption[]>([]);
  const [selectedCities, setSelectedCities] = useState<SelectOption[]>([]);
  const [selectedYears, setSelectedYears] = useState<SelectOption[]>([]);

  const [moviePage, setMoviePage] = useState(1);
  const [cityPage, setCityPage] = useState(1);

  const itemsPerPage = 25;

  const [movieSortColumn, setMovieSortColumn] =
    useState<string>("movie_total_gross");
  const [movieSortAsc, setMovieSortAsc] = useState(false);

  const [citySortColumn, setCitySortColumn] =
    useState<string>("movie_title");
  const [citySortAsc, setCitySortAsc] = useState(true);

  const toIndianFormat = (num?: number | null) =>
    new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(Number(num || 0));

  const toCrores = (num?: number | null) =>
    `${(Number(num || 0) / 10000000).toFixed(2)} Cr`;

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

  const weekColumns = useMemo(() => {
    const cols = new Set<string>();

    data.forEach((row) => {
      Object.keys(row).forEach((key) => {
        const match = key.match(/^week_(\d+)$/);

        if (!match) return;

        const weekNumber = Number(match[1]);

        if (weekNumber >= 1 && weekNumber <= 20) {
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

      const matches = key.match(/_plus_w\d+/g);

      return matches ? matches.length : 0;
    };

    return [...cols].sort(
      (a, b) => depth(a) - depth(b)
    );
  }, [data]);

  const formatColumnName = (column: string) => {
    if (column === "movie_title") return "Movie";
    if (column === "city") return "City";
    if (column === "release_year") return "Release Year";
    if (column === "movie_total_gross") return "Movie Total Gross";
    if (column === "total_gross") return "City Total Gross";
    if (column === "day_1_gross") return "Day 1";

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

  const filteredCityData = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    return data.filter((row) => {
      if (
        selectedMovies.length > 0 &&
        !selectedMovies.some(
          (item) => item.value === row.movie_title
        )
      ) {
        return false;
      }

      if (
        selectedCities.length > 0 &&
        !selectedCities.some(
          (item) => item.value === row.city
        )
      ) {
        return false;
      }

      if (
        selectedYears.length > 0 &&
        !selectedYears.some(
          (item) =>
            Number(item.value) === Number(row.release_year)
        )
      ) {
        return false;
      }

      if (searchText) {
        const combined = [
          row.movie_title,
          row.city,
          row.release_year,
        ]
          .join(" ")
          .toLowerCase();

        if (!combined.includes(searchText)) {
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
  // One row per Movie + Release Year
  // ------------------------------------------------------------

  const movieTotals = useMemo(() => {
    const groups = new Map<string, MovieData>();

    filteredCityData.forEach((row) => {
      const key =
        `${row.movie_title}__${row.release_year}`;

      if (!groups.has(key)) {
        groups.set(key, {
          movie_title: row.movie_title,
          city: "",
          release_year: Number(row.release_year),
          movie_total_gross: Number(
            row.movie_total_gross || 0
          ),
        });
      } else {
        const existing = groups.get(key)!;

        existing.movie_total_gross = Math.max(
          Number(existing.movie_total_gross || 0),
          Number(row.movie_total_gross || 0)
        );
      }
    });

    return [...groups.values()];
  }, [filteredCityData]);

  const sortedMovieTotals = useMemo(() => {
    const rows = [...movieTotals];

    rows.sort((a, b) => {
      const aValue = a[movieSortColumn];
      const bValue = b[movieSortColumn];

      if (
        typeof aValue === "string" ||
        typeof bValue === "string"
      ) {
        const first = String(aValue || "");
        const second = String(bValue || "");

        return movieSortAsc
          ? first.localeCompare(second)
          : second.localeCompare(first);
      }

      const first = Number(aValue || 0);
      const second = Number(bValue || 0);

      return movieSortAsc
        ? first - second
        : second - first;
    });

    return rows;
  }, [
    movieTotals,
    movieSortColumn,
    movieSortAsc,
  ]);

  const sortedCityData = useMemo(() => {
    const rows = [...filteredCityData];

    rows.sort((a, b) => {
      const aValue = a[citySortColumn];
      const bValue = b[citySortColumn];

      if (
        typeof aValue === "string" ||
        typeof bValue === "string"
      ) {
        const first = String(aValue || "");
        const second = String(bValue || "");

        return citySortAsc
          ? first.localeCompare(second)
          : second.localeCompare(first);
      }

      const first = Number(aValue || 0);
      const second = Number(bValue || 0);

      return citySortAsc
        ? first - second
        : second - first;
    });

    return rows;
  }, [
    filteredCityData,
    citySortColumn,
    citySortAsc,
  ]);

  const handleMovieSort = (column: string) => {
    if (movieSortColumn === column) {
      setMovieSortAsc((old) => !old);
    } else {
      setMovieSortColumn(column);

      if (column === "movie_title") {
        setMovieSortAsc(true);
      } else {
        setMovieSortAsc(false);
      }
    }

    setMoviePage(1);
  };

  const handleCitySort = (column: string) => {
    if (citySortColumn === column) {
      setCitySortAsc((old) => !old);
    } else {
      setCitySortColumn(column);

      if (
        column === "movie_title" ||
        column === "city"
      ) {
        setCitySortAsc(true);
      } else {
        setCitySortAsc(false);
      }
    }

    setCityPage(1);
  };

  useEffect(() => {
    setMoviePage(1);
    setCityPage(1);
  }, [
    search,
    selectedMovies,
    selectedCities,
    selectedYears,
  ]);

  const movieTotalPages = Math.max(
    1,
    Math.ceil(
      sortedMovieTotals.length / itemsPerPage
    )
  );

  const cityTotalPages = Math.max(
    1,
    Math.ceil(
      sortedCityData.length / itemsPerPage
    )
  );

  const paginatedMovieTotals =
    sortedMovieTotals.slice(
      (moviePage - 1) * itemsPerPage,
      moviePage * itemsPerPage
    );

  const paginatedCityData =
    sortedCityData.slice(
      (cityPage - 1) * itemsPerPage,
      cityPage * itemsPerPage
    );

  const allMovieGross = useMemo(
    () =>
      movieTotals.reduce(
        (sum, row) =>
          sum +
          Number(row.movie_total_gross || 0),
        0
      ),
    [movieTotals]
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
        placeholder="Search movie / city / release year..."
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
      />

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
          <p>{movieTotals.length}</p>
        </div>

        <div className="kpi-card">
          <h3>Movie × City Records</h3>
          <p>{filteredCityData.length}</p>
        </div>

      </div>

      {/* ========================================================
          SECTION 1 — MOVIE TOTAL GROSS
      ======================================================== */}

      <h2
        style={{
          textAlign: "center",
          marginTop: "2rem",
        }}
      >
        Movie Total Gross
      </h2>

      <div className="table-scroll">

        <table>

          <thead>
            <tr>

              <th
                onClick={() =>
                  handleMovieSort(
                    "movie_title"
                  )
                }
              >
                Movie
              </th>

              <th
                onClick={() =>
                  handleMovieSort(
                    "release_year"
                  )
                }
              >
                Release Year
              </th>

              <th
                onClick={() =>
                  handleMovieSort(
                    "movie_total_gross"
                  )
                }
              >
                Movie Total Gross
              </th>

            </tr>
          </thead>

          <tbody>

            {paginatedMovieTotals.map(
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

                </tr>
              )
            )}

          </tbody>

        </table>

      </div>

      {movieTotalPages > 1 && (
        <div className="pagination">

          <button
            disabled={moviePage === 1}
            onClick={() =>
              setMoviePage((old) =>
                Math.max(old - 1, 1)
              )
            }
          >
            Prev
          </button>

          <span>
            Page {moviePage} of {movieTotalPages}
            {" — "}
            {sortedMovieTotals.length} movies
          </span>

          <button
            disabled={
              moviePage >= movieTotalPages
            }
            onClick={() =>
              setMoviePage((old) =>
                Math.min(
                  old + 1,
                  movieTotalPages
                )
              )
            }
          >
            Next
          </button>

        </div>
      )}

      {/* ========================================================
          SECTION 2 — CITY BREAKDOWN
      ======================================================== */}

      <h2
        style={{
          textAlign: "center",
          marginTop: "3rem",
        }}
      >
        Movie × City Collections
      </h2>

      <div className="table-scroll">

        <table>

          <thead>
            <tr>

              <th
                onClick={() =>
                  handleCitySort(
                    "movie_title"
                  )
                }
              >
                Movie
              </th>

              <th
                onClick={() =>
                  handleCitySort("city")
                }
              >
                City
              </th>

              <th
                onClick={() =>
                  handleCitySort(
                    "release_year"
                  )
                }
              >
                Release Year
              </th>

              {cumulativeColumns.map(
                (column) => (
                  <th
                    key={column}
                    onClick={() =>
                      handleCitySort(column)
                    }
                  >
                    {formatColumnName(column)}
                  </th>
                )
              )}

              <th
                onClick={() =>
                  handleCitySort(
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
                      handleCitySort(column)
                    }
                  >
                    {formatColumnName(column)}
                  </th>
                )
              )}

              <th
                onClick={() =>
                  handleCitySort(
                    "total_gross"
                  )
                }
              >
                City Total Gross
              </th>

            </tr>
          </thead>

          <tbody>

            {paginatedCityData.map(
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

      {cityTotalPages > 1 && (
        <div className="pagination">

          <button
            disabled={cityPage === 1}
            onClick={() =>
              setCityPage((old) =>
                Math.max(old - 1, 1)
              )
            }
          >
            Prev
          </button>

          <span>
            Page {cityPage} of {cityTotalPages}
            {" — "}
            {sortedCityData.length} records
          </span>

          <button
            disabled={
              cityPage >= cityTotalPages
            }
            onClick={() =>
              setCityPage((old) =>
                Math.min(
                  old + 1,
                  cityTotalPages
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
