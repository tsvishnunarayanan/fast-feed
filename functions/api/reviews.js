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

    const summary = await db.prepare(`
      SELECT
        COUNT(*) AS total,
        ROUND(AVG(rating), 1) AS average
      FROM reviews
    `).first();


    const distributionRows = await db.prepare(`
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


    const reviewsResult = await db.prepare(`
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


    return json({
      success: true,

      totalRatings:
        Number(summary?.total || 0),

      averageRating:
        Number(summary?.average || 0),

      distribution,

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

    let name =
      String(
        body.name || ""
      ).trim();

    let review =
      String(
        body.review || ""
      ).trim();


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


    if (!name) {
      name = "Anonymous";
    }


    await db.prepare(`
      INSERT INTO reviews (
        name,
        rating,
        review
      )
      VALUES (?, ?, ?)
    `)
      .bind(
        name,
        rating,
        review
      )
      .run();


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
