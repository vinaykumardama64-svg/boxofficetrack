import { createClient } from "@tursodatabase/serverless";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export default async () => {
  try {
    if (!process.env.TURSO_DATABASE_URL) {
      throw new Error("TURSO_DATABASE_URL is not configured");
    }

    if (!process.env.TURSO_AUTH_TOKEN) {
      throw new Error("TURSO_AUTH_TOKEN is not configured");
    }

    const result = await client.execute(`
      SELECT *
      FROM film_collection_wide
      ORDER BY movie_total_gross DESC
    `);

    const rows = result.rows.map((row) => {
      const output: Record<string, unknown> = {};

      result.columns.forEach((column, index) => {
        output[column] = row[index];
      });

      return output;
    });

    return new Response(
      JSON.stringify({
        data: rows,
        count: rows.length,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
        },
      }
    );
  } catch (error) {
    console.error("Turso query failed:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unable to fetch box office data",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
