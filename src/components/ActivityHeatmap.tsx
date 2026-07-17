type ActivityHeatmapProps = {
  submissionCalendar: string;
};

type ActivityMap = Record<string, number>;

type ActivityDay = {
  date: Date;
  dateKey: string;
  solved: number;
  level: number;
};

type HeatmapCell =
  | {
      type: "placeholder";
      key: string;
    }
  | {
      type: "day";
      key: string;
      day: ActivityDay;
    };

type MonthGroup = {
  key: string;
  name: string;
  cells: HeatmapCell[];
};

const MONTH_COUNT = 6;


/* ========================================
   LOCAL DATE KEY
======================================== */

function formatLocalDateKey(
  date: Date
): string {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/* ========================================
   LEETCODE TIMESTAMP DATE KEY
======================================== */

function formatTimestampDateKey(
  timestamp: string
): string {
  const timestampSeconds =
    Number(timestamp);

  if (
    !Number.isFinite(
      timestampSeconds
    )
  ) {
    return "";
  }

  const date =
    new Date(
      timestampSeconds * 1000
    );

  /*
    LeetCode calendar timestamps are
    converted using UTC so the date
    does not shift because of the
    computer's local timezone.
  */

  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getUTCDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


/* ========================================
   ACTIVITY LEVEL
======================================== */

function getActivityLevel(
  solved: number
): number {
  if (solved <= 0) {
    return 0;
  }

  if (solved === 1) {
    return 1;
  }

  if (solved <= 3) {
    return 2;
  }

  return 3;
}


/* ========================================
   PARSE LEETCODE CALENDAR
======================================== */

function parseSubmissionCalendar(
  submissionCalendar: string
): ActivityMap {
  if (!submissionCalendar) {
    return {};
  }

  try {
    const rawCalendar:
      Record<string, number> =
        JSON.parse(
          submissionCalendar
        );

    const activityMap:
      ActivityMap = {};


    for (
      const [
        timestamp,
        submissionCount,
      ] of Object.entries(
        rawCalendar
      )
    ) {
      const dateKey =
        formatTimestampDateKey(
          timestamp
        );


      if (!dateKey) {
        continue;
      }


      const solved =
        Number(
          submissionCount
        );


      if (
        !Number.isFinite(
          solved
        )
      ) {
        continue;
      }


      activityMap[dateKey] =
        (
          activityMap[dateKey] ??
          0
        ) + solved;
    }


    return activityMap;

  } catch (error) {

    console.error(
      "Could not parse submission calendar:",
      error
    );

    return {};
  }
}


/* ========================================
   GENERATE LAST 6 MONTHS
======================================== */

function generateMonths(
  activityMap: ActivityMap
): MonthGroup[] {

  const now =
    new Date();


  const today =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );


  const months:
    MonthGroup[] = [];


  for (
    let monthOffset =
      MONTH_COUNT - 1;

    monthOffset >= 0;

    monthOffset--
  ) {

    const targetDate =
      new Date(
        today.getFullYear(),
        today.getMonth() -
          monthOffset,
        1
      );


    const year =
      targetDate.getFullYear();

    const month =
      targetDate.getMonth();


    const monthKey =
      `${year}-${String(
        month + 1
      ).padStart(2, "0")}`;


    const cells:
      HeatmapCell[] = [];


    /* ====================================
       ADD WEEKDAY PLACEHOLDERS

       JavaScript getDay():

       Sunday    = 0
       Monday    = 1
       Tuesday   = 2
       Wednesday = 3
       Thursday  = 4
       Friday    = 5
       Saturday  = 6

       Because the CSS grid fills
       vertically using 7 rows,
       these placeholders move day 1
       to the correct weekday row.
    ==================================== */

    const firstDayOfWeek =
      new Date(
        year,
        month,
        1
      ).getDay();


    for (
      let placeholderIndex = 0;

      placeholderIndex <
        firstDayOfWeek;

      placeholderIndex++
    ) {

      cells.push({
        type:
          "placeholder",

        key:
          `${monthKey}-placeholder-${placeholderIndex}`,
      });

    }


    /* ====================================
       NUMBER OF DAYS IN MONTH
    ==================================== */

    const daysInMonth =
      new Date(
        year,
        month + 1,
        0
      ).getDate();


    /* ====================================
       ADD REAL DAYS
    ==================================== */

    for (
      let day = 1;

      day <= daysInMonth;

      day++
    ) {

      const date =
        new Date(
          year,
          month,
          day
        );


      /*
        Do not render future dates
        in the current month.
      */

      if (date > today) {
        break;
      }


      const dateKey =
        formatLocalDateKey(
          date
        );


      const solved =
        activityMap[
          dateKey
        ] ?? 0;


      const activityDay:
        ActivityDay = {

          date,

          dateKey,

          solved,

          level:
            getActivityLevel(
              solved
            ),
        };


      cells.push({
        type:
          "day",

        key:
          dateKey,

        day:
          activityDay,
      });

    }


    months.push({

      key:
        monthKey,

      name:
        targetDate
          .toLocaleString(
            "en-US",
            {
              month:
                "short",
            }
          ),

      cells,
    });

  }


  return months;
}


/* ========================================
   ACTIVITY HEATMAP COMPONENT
======================================== */

function ActivityHeatmap({
  submissionCalendar,
}: ActivityHeatmapProps) {

  const activityMap =
    parseSubmissionCalendar(
      submissionCalendar
    );


  const months =
    generateMonths(
      activityMap
    );


  return (

    <div className="heatmap">

      {months.map(
        (month) => (

          <div
            className="month"
            key={
              month.key
            }
          >

            <div className="month-grid">

              {month.cells.map(
                (cell) => {


                  /* ========================
                     EMPTY WEEKDAY POSITION
                  ======================== */

                  if (
                    cell.type ===
                    "placeholder"
                  ) {

                    return (

                      <div
                        key={
                          cell.key
                        }

                        className="activity-cell-placeholder"

                        aria-hidden="true"
                      />

                    );

                  }


                  /* ========================
                     REAL ACTIVITY DAY
                  ======================== */

                  const day =
                    cell.day;


                  return (

                    <div
                      key={
                        cell.key
                      }

                      className={
                        `activity-cell level-${day.level}`
                      }

                      title={
                        `${day.date.toLocaleDateString(
                          "en-US",
                          {
                            month:
                              "long",

                            day:
                              "numeric",

                            year:
                              "numeric",
                          }
                        )} · ${day.solved} ${
                          day.solved === 1
                            ? "submission"
                            : "submissions"
                        }`
                      }
                    />

                  );

                }
              )}

            </div>


            <span className="month-label">

              {month.name}

            </span>

          </div>

        )
      )}

    </div>

  );
}


export default ActivityHeatmap;