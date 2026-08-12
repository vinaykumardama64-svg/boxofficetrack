import { connect } from "@tursodatabase/serverless";

export default async (request: Request) => {
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

    // =========================================================
    // PAGINATION
    // =========================================================

    const requestUrl = new URL(request.url);

    const pageParam = Number(
      requestUrl.searchParams.get("page") || "1"
    );

    const limitParam = Number(
      requestUrl.searchParams.get("limit") || "1000"
    );

    const page =
      Number.isFinite(pageParam) && pageParam > 0
        ? Math.floor(pageParam)
        : 1;

    // Hard maximum protects Netlify response size.
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(Math.floor(limitParam), 1500)
        : 1000;

    const offset = (page - 1) * limit;

    // =========================================================
    // TOTAL ROW COUNT
    // =========================================================

    const countStmt = db.prepare(`
      SELECT COUNT(*) AS total
      FROM film_collection_wide
    `);

    const countRow = await countStmt.get();

    const total = Number(
      countRow?.total || 0
    );

    // =========================================================
    // FETCH ONE PAGE
    // =========================================================

    const stmt = db.prepare(`
      SELECT *
      FROM film_collection_wide
      ORDER BY movie_total_gross DESC,
               movie_title ASC,
               city ASC
      LIMIT ?
      OFFSET ?
    `);

    const rows = await stmt.all([
      limit,
      offset,
    ]);

    const totalPages =
      total === 0
        ? 0
        : Math.ceil(total / limit);

    const hasMore =
      page < totalPages;

    console.log(
      `BoxOffice page ${page}/${totalPages}: ` +
      `${rows.length} rows, total ${total}`
    );

    return new Response(
      JSON.stringify({
        data: rows,

        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore,
        },
      }),
      {
        status: 200,

        headers: {
          "Content-Type":
            "application/json; charset=utf-8",

          "Cache-Control":
            "public, max-age=300",
        },
      }
    );
  } catch (error) {
    console.error(
      "BOXOFFICE_FUNCTION_ERROR:",
      error
    );

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
          "Content-Type":
            "application/json; charset=utf-8",
        },
      }
    );
  }
};
