import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import Select from "react-select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LabelList,
} from "recharts";

interface MovieData {
  movie_title: string;
  city: string;
  release_year: number;

  day_1_gross?: number | null;

  total_gross?: number | null;
  movie_total_gross?: number | null;
  cume_total?: number | null;

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

  const [page, setPage] = useState(1);
  const itemsPerPage = 25;

  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortAsc, setSortAsc] = useState(true);

  const toIndianFormat = (num?: number | null) => {
    const value = Number(num || 0);

    return new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: 0,
    }).format(value);
  };

  const toCrores = (num?: number | null) => {
    return `${(Number(num || 0) / 10000000).toFixed(2)} Cr`;
  };

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

      const uniqueMovies = [
        ...new Set(
          rows
            .map((row) => row.movie_title)
            .filter(Boolean)
        ),
      ].sort();

      const uniqueCities = [
        ...new Set(
          rows
            .map((row) => row.city)
            .filter(Boolean)
        ),
      ].sort();

      const uniqueYears = [
        ...new Set(
          rows
            .map((row) => Number(row.release_year))
            .filter((year) => !Number.isNaN(year))
        ),
      ].sort((a, b) => b - a);

      setMovies(uniqueMovies);
      setCities(uniqueCities);
      setYears(uniqueYears);
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
        if (/^week_\d+$/.test(key)) {
          const weekNumber = Number(key.replace("week_", ""));

          if (weekNumber >= 1 && weekNumber <= 20) {
            cols.add(key);
          }
        }
      });
    });

    return [...cols].sort((a, b) => {
      const aNum = Number(a.replace("week_", ""));
      const bNum = Number(b.replace("week_", ""));

      return aNum - bNum;
    });
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

    return [...cols].sort((a, b) => {
      const getDepth = (value: string) => {
        if (value === "cume_d1") return 0;

        const matches = value.match(/_plus_w\d+/g);

        return matches ? matches.length : 0;
      };

      return getDepth(a) - getDepth(b);
    });
  }, [data]);

  const formatColumnName = (column: string) => {
    if (column === "movie_title") return "Movie";
    if (column === "city") return "City";
    if (column === "release_year") return "Release Year";

    if (column === "cume_total") {
      return "Total Cumulative Gross";
    }

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
      let label = column
        .replace("cume_", "")
        .replaceAll("_plus_", "+")
        .replaceAll("_", " ")
        .toUpperCase();

      return `Cume ${label}`;
    }

    return column;
  };

  const filteredData = useMemo(() => {
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

  const sortedData = useMemo(() => {
    const output = [...filteredData];

    if (!sortColumn) {
      return output.sort(
        (a, b) =>
          Number(b.movie_total_gross || 0) -
          Number(a.movie_total_gross || 0)
      );
    }

    output.sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (
        typeof aValue === "string" ||
        typeof bValue === "string"
      ) {
        return sortAsc
          ? String(aValue || "").localeCompare(
              String(bValue || "")
            )
          : String(bValue || "").localeCompare(
              String(aValue || "")
            );
      }

      return sortAsc
        ? Number(aValue || 0) - Number(bValue || 0)
        : Number(bValue || 0) - Number(aValue || 0);
    });

    return output;
  }, [filteredData, sortColumn, sortAsc]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [
    search,
    selectedMovies,
    selectedCities,
    selectedYears,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedData.length / itemsPerPage)
  );

  const paginatedData = sortedData.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalCumulativeGross = sortedData.reduce(
    (sum, row) =>
      sum + Number(row.cume_total || row.total_gross || 0),
    0
  );

  const totalDay1 = sortedData.reduce(
    (sum, row) =>
      sum + Number(row.day_1_gross || 0),
    0
  );

  const totalWeek1 = sortedData.reduce(
    (sum, row) =>
      sum + Number(row.week_1 || 0),
    0
  );

  const groupedMovies = useMemo(() => {
    const result: Record<
      string,
      {
        movie: string;
        releaseYear: number;
        total: number;
        day1: number;
        week1: number;
      }
    > = {};

    filteredData.forEach((row) => {
      const key = `${row.movie_title}__${row.release_year}`;

      if (!result[key]) {
        result[key] = {
          movie: row.movie_title,
          releaseYear: Number(row.release_year),
          total: Number(row.movie_total_gross || 0),
          day1: 0,
          week1: 0,
        };
      }

      result[key].day1 += Number(
        row.day_1_gross || 0
      );

      result[key].week1 += Number(
        row.week_1 || 0
      );
    });

    return Object.values(result)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [filteredData]);

  if (loading) {
    return (
      <div className="App">
        <h1>🎬 BoxOfficeTrack</h1>
        <div className="spinner"></div>
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
        placeholder="Search movie / city / release year..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-input"
      />

      <div className="filters">
        <Select
          isMulti
          options={movies.map((movie) => ({
            value: movie,
            label: movie,
          }))}
          value={selectedMovies}
          onChange={(selected) =>
            setSelectedMovies(
              selected as SelectOption[]
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
          onChange={(selected) =>
            setSelectedCities(
              selected as SelectOption[]
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
          onChange={(selected) =>
            setSelectedYears(
              selected as SelectOption[]
            )
          }
          placeholder="Release Year"
        />
      </div>

      <div className="kpi-container">
        <div className="kpi-card">
          <h3>Total Cumulative Gross</h3>

          <p>
            ₹{toIndianFormat(totalCumulativeGross)}
          </p>

          <small>
            ₹{toCrores(totalCumulativeGross)}
          </small>
        </div>

        <div className="kpi-card">
          <h3>Total Day 1</h3>

          <p>
            ₹{toIndianFormat(totalDay1)}
          </p>
        </div>

        <div className="kpi-card">
          <h3>Total Week 1</h3>

          <p>
            ₹{toIndianFormat(totalWeek1)}
          </p>
        </div>

        <div className="kpi-card">
          <h3>Movie × City Records</h3>

          <p>{sortedData.length}</p>
        </div>
      </div>

      <h2
        style={{
          textAlign: "center",
          marginTop: "2rem",
        }}
      >
        Movie × City Collections
      </h2>

      <div
        style={{
          width: "100%",
          overflowX: "auto",
        }}
      >
        <table>
          <thead>
            <tr>
              <th
                onClick={() =>
                  handleSort("movie_title")
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
                  handleSort("release_year")
                }
              >
                Release Year
              </th>

              <th
                onClick={() =>
                  handleSort("cume_total")
                }
              >
                Total Cumulative Gross
              </th>

              {cumulativeColumns.map((column) => (
                <th
                  key={column}
                  onClick={() =>
                    handleSort(column)
                  }
                >
                  {formatColumnName(column)}
                </th>
              ))}

              <th
                onClick={() =>
                  handleSort("day_1_gross")
                }
              >
                Day 1
              </th>

              {weekColumns.map((column) => (
                <th
                  key={column}
                  onClick={() =>
                    handleSort(column)
                  }
                >
                  {formatColumnName(column)}
                </th>
              ))}

              <th
                onClick={() =>
                  handleSort("total_gross")
                }
              >
                City Total Gross
              </th>

              <th
                onClick={() =>
                  handleSort("movie_total_gross")
                }
              >
                Movie Total Gross
              </th>
            </tr>
          </thead>

          <tbody>
            {paginatedData.map((row, index) => (
              <tr
                key={`${row.movie_title}-${row.release_year}-${row.city}-${index}`}
              >
                <td>{row.movie_title}</td>

                <td>{row.city}</td>

                <td>{row.release_year}</td>

                <td>
                  ₹
                  {toIndianFormat(
                    Number(
                      row.cume_total ||
                        row.total_gross ||
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
                          row[column] || 0
                        )
                      )}
                    </td>
                  )
                )}

                <td>
                  ₹
                  {toIndianFormat(
                    Number(
                      row.day_1_gross || 0
                    )
                  )}
                </td>

                {weekColumns.map((column) => (
                  <td key={column}>
                    ₹
                    {toIndianFormat(
                      Number(
                        row[column] || 0
                      )
                    )}
                  </td>
                ))}

                <td>
                  ₹
                  {toIndianFormat(
                    Number(
                      row.total_gross || 0
                    )
                  )}
                </td>

                <td>
                  ₹
                  {toIndianFormat(
                    Number(
                      row.movie_total_gross || 0
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={page === 1}
            onClick={() =>
              setPage((p) =>
                Math.max(p - 1, 1)
              )
            }
          >
            Prev
          </button>

          <span>
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page >= totalPages}
            onClick={() =>
              setPage((p) =>
                Math.min(
                  p + 1,
                  totalPages
                )
              )
            }
          >
            Next
          </button>
        </div>
      )}

      <h2
        style={{
          textAlign: "center",
          marginTop: "3rem",
        }}
      >
        Top Movies by Total Gross
      </h2>

      <div
        style={{
          width: "100%",
          height: 600,
        }}
      >
        <ResponsiveContainer
          width="100%"
          height="100%"
        >
          <BarChart
            data={groupedMovies}
            layout="vertical"
            margin={{
              top: 20,
              right: 100,
              left: 130,
              bottom: 5,
            }}
          >
            <XAxis type="number" />

            <YAxis
              dataKey="movie"
              type="category"
              width={170}
            />

            <Tooltip
              formatter={(value: number) => [
                `₹${toCrores(value)}`,
                "",
              ]}
            />

            <Legend />

            <Bar
              dataKey="total"
              name="Movie Total Gross"
              fill="#198754"
            >
              <LabelList
                dataKey="total"
                position="right"
                formatter={(value: number) =>
                  toCrores(value)
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default App;
