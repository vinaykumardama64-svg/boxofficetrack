import React, { useEffect, useState } from "react";
import "./App.css";
import { createClient } from "@supabase/supabase-js";
import Select from "react-select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  LabelList,
} from "recharts";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface MovieData {
  id: number;
  movie: string;
  region: string;
  area: string;
  day1: number;
  week1: number;
  final_gross: number;
  last_updated: string;
}

function App() {
  const [data, setData] = useState<MovieData[]>([]);
  const [search, setSearch] = useState("");
  const [movies, setMovies] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [selectedMovies, setSelectedMovies] = useState<{ value: string; label: string }[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<{ value: string; label: string }[]>([]);
  const [selectedAreas, setSelectedAreas] = useState<{ value: string; label: string }[]>([]);
  const [page, setPage] = useState(1);
  const [groupedPage, setGroupedPage] = useState(1);
  const itemsPerPage = 25;
  const groupedItemsPerPage = 20;
  const [sortColumn, setSortColumn] = useState<keyof MovieData | "">("");
  const [sortAsc, setSortAsc] = useState(true);

  const toIndianFormat = (num: number) =>
    new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(num);

  const fetchFilters = async () => {
    const [movieData, regionData, areaData] = await Promise.all([
      supabase.from("box_office_data").select("movie"),
      supabase.from("box_office_data").select("region"),
      supabase.from("box_office_data").select("area"),
    ]);

    if (movieData.data)
      setMovies([...new Set(movieData.data.map((d) => d.movie))].sort());
    if (regionData.data)
      setRegions([...new Set(regionData.data.map((d) => d.region))].sort());
    if (areaData.data)
      setAreas([...new Set(areaData.data.map((d) => d.area))].sort());
  };

  const fetchData = async () => {
    let query = supabase.from("box_office_data").select("*").limit(75000);

    if (selectedMovies.length > 0) {
      const baseTitles = selectedMovies.map((s) => s.value.replace(/\s*\(.*?\)$/, ""));
      const filters = baseTitles.map((title) => `movie.ilike.${title}%`).join(",");
      query = query.or(filters);
    }
    if (selectedRegions.length > 0)
      query = query.in("region", selectedRegions.map((s) => s.value));
    if (selectedAreas.length > 0)
      query = query.in("area", selectedAreas.map((s) => s.value));

    const { data: fetchedData, error } = await query;
    if (fetchedData) setData(fetchedData);
    if (error) console.error("Could not fetch data:", error);
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedMovies, selectedRegions, selectedAreas]);

  const filteredData = data.filter((entry) =>
    Object.values(entry).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;
    const valA = a[sortColumn];
    const valB = b[sortColumn];
    if (valA === undefined || valB === undefined) return 0;
    if (typeof valA === "string" && typeof valB === "string") {
      return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
  });

  const totalDay1 = sortedData.reduce((sum, d) => sum + (d.day1 || 0), 0);
  const totalWeek1 = sortedData.reduce((sum, d) => sum + (d.week1 || 0), 0);
  const totalFinal = sortedData.reduce((sum, d) => sum + (d.final_gross || 0), 0);

  const latestUpdate = sortedData.reduce((latest, item) => {
    return latest > item.last_updated ? latest : item.last_updated;
  }, "");

  const paginatedData = sortedData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleSort = (column: keyof MovieData) => {
    if (sortColumn === column) {
      setSortAsc(!sortAsc);
    } else {
      setSortColumn(column);
      setSortAsc(true);
    }
  };

  const groupedByBaseTitle = Object.values(
    filteredData.reduce((acc, item) => {
      const baseTitle = item.movie.replace(/\s*\(.*?\)$/, "");
      if (!acc[baseTitle]) {
        acc[baseTitle] = { movie: baseTitle, day1: 0, week1: 0, final: 0 };
      }
      acc[baseTitle].day1 += item.day1 || 0;
      acc[baseTitle].week1 += item.week1 || 0;
      acc[baseTitle].final += item.final_gross || 0;
      return acc;
    }, {} as Record<string, { movie: string; day1: number; week1: number; final: number }>)
  ).sort((a, b) => b.final - a.final);

  const paginatedGrouped = groupedByBaseTitle.slice(
    (groupedPage - 1) * groupedItemsPerPage,
    groupedPage * groupedItemsPerPage
  );

  return (
    <div className="App">
      <h1>🎬 BoxOfficeTrack</h1>

      <input
        type="text"
        placeholder="Search movie / region / area..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-input"
      />

      <div className="filters">
        <Select
          isMulti
          options={movies.map((m) => ({ value: m, label: m }))}
          onChange={(selected) => setSelectedMovies(selected as any)}
          placeholder="Select Movie(s)"
        />
        <Select
          isMulti
          options={regions.map((r) => ({ value: r, label: r }))}
          onChange={(selected) => setSelectedRegions(selected as any)}
          placeholder="Select Region(s)"
        />
        <Select
          isMulti
          options={areas.map((a) => ({ value: a, label: a }))}
          onChange={(selected) => setSelectedAreas(selected as any)}
          placeholder="Select Area(s)"
        />
      </div>

      <div className="kpi-container">
        <div className="kpi-card">
          <h3>Total Day 1</h3>
          <p>₹{toIndianFormat(totalDay1)}</p>
        </div>
        <div className="kpi-card">
          <h3>Total Week 1</h3>
          <p>₹{toIndianFormat(totalWeek1)}</p>
        </div>
        <div className="kpi-card">
          <h3>Total Final Gross</h3>
          <p>₹{toIndianFormat(totalFinal)}</p>
        </div>
        <div className="kpi-card">
          <h3>Records</h3>
          <p>{sortedData.length}</p>
        </div>
        <div className="kpi-card">
          <h3>Last Updated</h3>
          <p>{latestUpdate ? new Date(latestUpdate).toLocaleString() : "--"}</p>
        </div>
      </div>

      <h2 style={{ textAlign: "center", marginTop: "2rem" }}>All Versions</h2>
      <table>
        <thead>
          <tr>
            <th>Movie</th>
            <th>Day 1</th>
            <th>Week 1</th>
            <th>Final Gross</th>
          </tr>
        </thead>
        <tbody>
          {paginatedGrouped.map((entry, i) => (
            <tr key={i}>
              <td>{entry.movie}</td>
              <td>₹{toIndianFormat(entry.day1)}</td>
              <td>₹{toIndianFormat(entry.week1)}</td>
              <td>₹{toIndianFormat(entry.final)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {groupedByBaseTitle.length > groupedItemsPerPage && (
        <div className="pagination">
          <button onClick={() => setGroupedPage(Math.max(groupedPage - 1, 1))}>Prev</button>
          <button
            onClick={() =>
              setGroupedPage((p) =>
                p * groupedItemsPerPage < groupedByBaseTitle.length ? p + 1 : p
              )
            }
          >
            Next
          </button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort("movie")}>Movie</th>
            <th onClick={() => handleSort("region")}>Region</th>
            <th onClick={() => handleSort("area")}>Area</th>
            <th onClick={() => handleSort("day1")}>Day 1</th>
            <th onClick={() => handleSort("week1")}>Week 1</th>
            <th onClick={() => handleSort("final_gross")}>Final Gross</th>
            <th onClick={() => handleSort("last_updated")}>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((entry) => (
            <tr key={entry.id}>
              <td>{entry.movie}</td>
              <td>{entry.region}</td>
              <td>{entry.area}</td>
              <td>₹{toIndianFormat(entry.day1)}</td>
              <td>₹{toIndianFormat(entry.week1)}</td>
              <td>₹{toIndianFormat(entry.final_gross)}</td>
              <td>{entry.last_updated}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sortedData.length > itemsPerPage && (
        <div className="pagination">
          <button onClick={() => setPage(Math.max(page - 1, 1))}>Prev</button>
          <button
            onClick={() =>
              setPage((p) => (p * itemsPerPage < sortedData.length ? p + 1 : p))
            }
          >
            Next
          </button>
        </div>
      )}

  <h2 style={{ textAlign: "center", marginTop: "2rem" }}>All versions top chart </h2>
<div style={{ width: "100%", height: 500 }}>
  <ResponsiveContainer width="100%" height="100%">
    <BarChart
      data={groupedByBaseTitle.slice(0, 20)}
      layout="vertical"
      margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
    >
      <XAxis type="number" />
      <YAxis dataKey="movie" type="category" width={150} />
      <Tooltip
        formatter={(value: number) => [`₹${(value / 10000000).toFixed(2)} Cr`, ""]}
      />
      <Legend />
      <Bar dataKey="day1" fill="#ffc107" name="Day 1">
        <LabelList
          dataKey="day1"
          position="right"
          formatter={(val: number) => `${(val / 10000000).toFixed(2)} Cr`}
        />
      </Bar>
      <Bar dataKey="week1" fill="#ff5722" name="Week 1">
        <LabelList
          dataKey="week1"
          position="right"
          formatter={(val: number) => `${(val / 10000000).toFixed(2)} Cr`}
        />
      </Bar>
      <Bar dataKey="final" fill="#198754" name="Final Gross">
        <LabelList
          dataKey="final"
          position="right"
          formatter={(val: number) => `${(val / 10000000).toFixed(2)} Cr`}
        />
      </Bar>
    </BarChart>
  </ResponsiveContainer>
</div>
<h2 style={{ textAlign: "center", marginTop: "2rem" }}>Gross Split by Version</h2>
<table>
  <thead>
    <tr>
      <th>Movie</th>
      <th>Day 1</th>
      <th>Week 1</th>
      <th>Final Gross</th>
    </tr>
  </thead>
  <tbody>
    {Object.values(
      sortedData.reduce((acc, item) => {
        if (!acc[item.movie]) {
          acc[item.movie] = {
            movie: item.movie,
            day1: 0,
            week1: 0,
            final: 0,
          };
        }
        acc[item.movie].day1 += item.day1 || 0;
        acc[item.movie].week1 += item.week1 || 0;
        acc[item.movie].final += item.final_gross || 0;
        return acc;
      }, {} as Record<string, { movie: string; day1: number; week1: number; final: number }>)
    )
      .sort((a, b) => b.final - a.final)
      .slice(0, 20)
      .map((entry, i) => (
        <tr key={i}>
          <td>{entry.movie}</td>
          <td>₹{(entry.day1 / 10000000).toFixed(2)} Cr</td>
          <td>₹{(entry.week1 / 10000000).toFixed(2)} Cr</td>
          <td>₹{(entry.final / 10000000).toFixed(2)} Cr</td>
        </tr>
      ))}
  </tbody>
</table>
</div>
  );
}

export default App;
