import { connect } from "@tursodatabase/serverless";

export default async () => {
  try {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error("TURSO_DATABASE_URL is missing");
    }

    if (!authToken) {
      throw new Error("TURSO_AUTH_TOKEN is missing");
    }

    const db = connect({
      url,
      authToken,
    });

    const stmt = db.prepare(`
      SELECT *
      FROM film_collection_wide
      ORDER BY movie_total_gross DESC
    `);

    // IMPORTANT:
    // stmt.all() itself returns the array of rows.
    const rows = await stmt.all();

    console.log(
      `Successfully fetched ${rows.length} rows from Turso`
    );

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
    console.error("BOXOFFICE_FUNCTION_ERROR:", error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : String(error),
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
