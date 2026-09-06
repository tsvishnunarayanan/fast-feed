function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "Cache-Control": "no-store"
      }
    }
  );
}


export async function onRequestGet(context) {
  try {
    const db = context.env.DB;

    const url =
      new URL(context.request.url);

    const voterId =
      (url.searchParams.get("voterId") || "")
        .trim();


    const summary = await db.prepare(`
      SELECT
        COUNT(*) AS total,
        ROUND(AVG(rating), 1) AS average
      FROM reviews
    `).first();


    const distributionRows =
      await db.prepare(`
        SELECT
          rating,
          COUNT(*) AS count
        FROM reviews
        GROUP BY rating
        ORDER BY rating DESC
      `).all();


    const distribution = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0
    };


    for (
      const row of
      distributionRows.results || []
    ) {
      distribution[
        String(row.rating)
      ] = row.count;
    }


    const reviewsResult =
      await db.prepare(`
        SELECT
          id,
          name,
          rating,
          review,
          created_at
        FROM reviews
        WHERE
          review IS NOT NULL
          AND TRIM(review) != ''
        ORDER BY id DESC
        LIMIT 30
      `).all();


    let alreadyRated = false;


    if (voterId) {
      const existing =
        await db.prepare(`
          SELECT id
          FROM reviews
          WHERE voter_id = ?
          LIMIT 1
        `)
          .bind(voterId)
          .first();


      alreadyRated =
        !!existing;
    }


    return json({
      success: true,

      totalRatings:
        Number(summary?.total || 0),

      averageRating:
        Number(summary?.average || 0),

      distribution,

      alreadyRated,

      reviews:
        reviewsResult.results || []
    });
  }

  catch (error) {
    return json(
      {
        success: false,
        error: "Could not load reviews."
      },
      500
    );
  }
}


export async function onRequestPost(context) {
  try {
    const db = context.env.DB;

    let body;


    try {
      body =
        await context.request.json();
    }

    catch (_) {
      return json(
        {
          success: false,
          error: "Invalid request."
        },
        400
      );
    }


    const rating =
      Number(body.rating);


    const voterId =
      String(
        body.voterId || ""
      ).trim();


    let name =
      String(
        body.name || ""
      ).trim();


    let review =
      String(
        body.review || ""
      ).trim();


    if (
      !voterId ||
      voterId.length > 100
    ) {
      return json(
        {
          success: false,
          error: "Invalid voter."
        },
        400
      );
    }


    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return json(
        {
          success: false,
          error: "Rating must be between 1 and 5."
        },
        400
      );
    }


    if (name.length > 40) {
      return json(
        {
          success: false,
          error: "Name is too long."
        },
        400
      );
    }


    if (review.length > 500) {
      return json(
        {
          success: false,
          error: "Review must be 500 characters or less."
        },
        400
      );
    }


    const existing =
      await db.prepare(`
        SELECT id
        FROM reviews
        WHERE voter_id = ?
        LIMIT 1
      `)
        .bind(voterId)
        .first();


    if (existing) {
      return json(
        {
          success: false,
          alreadyRated: true,
          error: "You have already rated Fast Feed."
        },
        409
      );
    }


    if (!name) {
      name =
        "Anonymous";
    }


    try {
      await db.prepare(`
        INSERT INTO reviews (
          voter_id,
          name,
          rating,
          review
        )
        VALUES (?, ?, ?, ?)
      `)
        .bind(
          voterId,
          name,
          rating,
          review
        )
        .run();
    }

    catch (error) {
      if (
        String(error)
          .toLowerCase()
          .includes("unique")
      ) {
        return json(
          {
            success: false,
            alreadyRated: true,
            error: "You have already rated Fast Feed."
          },
          409
        );
      }

      throw error;
    }


    return json(
      {
        success: true,
        message: "Thanks for rating Fast Feed!"
      },
      201
    );
  }

  catch (error) {
    return json(
      {
        success: false,
        error: "Could not submit review."
      },
      500
    );
  }
}
