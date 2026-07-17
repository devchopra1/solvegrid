import {
  FormEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";

import "./App.css";
import ActivityHeatmap from "./components/ActivityHeatmap";


/* ========================================
   TYPES
======================================== */

type DifficultyStats = {
  easy: number;
  medium: number;
  hard: number;
};


type LeetCodeStats = {
  username: string;

  totalSolved: number;
  totalProblems: number;

  difficulty: DifficultyStats;
  difficultyTotals: DifficultyStats;

  submissionCalendar: string;
};


type ContextMenuPosition = {
  x: number;
  y: number;
};


/* ========================================
   CONSTANTS
======================================== */

const USERNAME_STORAGE_KEY =
  "solvegrid-leetcode-username";


/*
  Automatically fetch fresh
  LeetCode data every 5 minutes.
*/

const AUTO_REFRESH_INTERVAL =
  5 * 60 * 1000;


/*
  When SolveGrid becomes visible again,
  refresh if the current data is at least
  2 minutes old.
*/

const FOCUS_REFRESH_THRESHOLD =
  2 * 60 * 1000;


/* ========================================
   PROGRESS CALCULATION
======================================== */

function getProgressDegrees(
  solved: number,
  total: number
): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(
    (solved / total) * 360,
    360
  );
}


/* ========================================
   SUBMISSION CALENDAR STATS HELPER
======================================== */

function getSubmissionStats(calendarJson: string) {
  let todaySolved = 0;
  let streak = 0;

  try {
    const calendar: Record<string, number> = JSON.parse(calendarJson || "{}");
    const solvedDates = new Set<string>();

    Object.keys(calendar).forEach((timestampStr) => {
      const timestamp = parseInt(timestampStr, 10) * 1000;
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      solvedDates.add(`${year}-${month}-${day}`);
    });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    Object.entries(calendar).forEach(([timestampStr, count]) => {
      const timestamp = parseInt(timestampStr, 10) * 1000;
      const date = new Date(timestamp);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (dateStr === todayStr) {
        todaySolved += count;
      }
    });

    let currentCheck = new Date();
    let currentCheckStr = todayStr;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    if (solvedDates.has(todayStr)) {
      while (solvedDates.has(currentCheckStr)) {
        streak++;
        currentCheck.setDate(currentCheck.getDate() - 1);
        currentCheckStr = `${currentCheck.getFullYear()}-${String(currentCheck.getMonth() + 1).padStart(2, "0")}-${String(currentCheck.getDate()).padStart(2, "0")}`;
      }
    } else if (solvedDates.has(yesterdayStr)) {
      currentCheck = yesterday;
      currentCheckStr = yesterdayStr;
      while (solvedDates.has(currentCheckStr)) {
        streak++;
        currentCheck.setDate(currentCheck.getDate() - 1);
        currentCheckStr = `${currentCheck.getFullYear()}-${String(currentCheck.getMonth() + 1).padStart(2, "0")}-${String(currentCheck.getDate()).padStart(2, "0")}`;
      }
    }
  } catch (e) {
    console.error("Failed to parse submission calendar:", e);
  }

  return { todaySolved, streak };
}


/* ========================================
   APP
======================================== */

function App() {

  /* ======================================
     STATE
  ====================================== */

  const [
    username,
    setUsername,
  ] =
    useState("");


  const [
    usernameInput,
    setUsernameInput,
  ] =
    useState("");


  const [
    stats,
    setStats,
  ] =
    useState<LeetCodeStats | null>(
      null
    );


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  const [
    contextMenu,
    setContextMenu,
  ] =
    useState<
      ContextMenuPosition | null
    >(null);


  const [
    positionLocked,
    setPositionLocked,
  ] =
    useState(() => {
      return localStorage.getItem("solvegrid-position-locked") === "true";
    });

  const [
    widgetSize,
    setWidgetSize,
  ] =
    useState<"small" | "medium" | "large">(() => {
      return (localStorage.getItem("solvegrid-widget-size") as any) || "medium";
    });

  const [
    launchWithWindows,
    setLaunchWithWindows,
  ] =
    useState(() => {
      const val = localStorage.getItem("solvegrid-launch-startup");
      return val === null ? true : val === "true";
    });

  const [
    lastUpdated,
    setLastUpdated,
  ] =
    useState<string | null>(() => {
      return localStorage.getItem("solvegrid-last-updated");
    });


  /*
    Stores the time of the most recent
    successful LeetCode request.

    Updating a ref does not cause
    the component to re-render.
  */

  const lastSuccessfulRefresh =
    useRef<number>(0);


  /*
    Prevents multiple requests from
    running at the same time.

    Example:

    - automatic refresh starts
    - user manually clicks refresh
    - visibility event also fires

    Only one request will be allowed.
  */

  const requestInProgress =
    useRef(false);


  /* ======================================
     LOAD SAVED USERNAME
  ====================================== */

  useEffect(() => {

    const savedUsername =
      localStorage.getItem(
        USERNAME_STORAGE_KEY
      );


    if (savedUsername) {

      setUsername(
        savedUsername
      );

    }

  }, []);


  /* ======================================
     FETCH LEETCODE STATS
  ====================================== */

  const loadStats =
    useCallback(
      async (
        targetUsername: string,
        isRefresh = false
      ) => {

        /*
          Do not start another request
          while one is already running.
        */

        if (
          requestInProgress.current
        ) {
          return;
        }


        requestInProgress.current =
          true;


        /*
          Initial load:
          show loading screen.

          Refresh:
          keep existing widget visible.
        */

        if (isRefresh) {

          setRefreshing(true);

        } else {

          setLoading(true);

        }


        /*
          Remove any previous error
          before trying again.
        */

        setError(null);


        try {

          const result =
            await invoke<
              LeetCodeStats
            >(
              "get_leetcode_stats",
              {
                username:
                  targetUsername,
              }
            );


          /*
            Update the widget with
            fresh LeetCode data.
          */

          setStats(result);


          /*
            Record the successful
            refresh time.
          */

          lastSuccessfulRefresh
            .current =
            Date.now();

          const now = new Date();
          let hours = now.getHours();
          const minutes = String(now.getMinutes()).padStart(2, "0");
          const ampm = hours >= 12 ? "PM" : "AM";
          hours = hours % 12;
          hours = hours ? hours : 12;
          const timeStr = `${hours}:${minutes} ${ampm}`;
          setLastUpdated(timeStr);
          localStorage.setItem("solvegrid-last-updated", timeStr);


          /*
            Save the validated username
            for future launches.
          */

          localStorage.setItem(
            USERNAME_STORAGE_KEY,
            targetUsername
          );


        } catch (error) {

          console.error(
            "LeetCode error:",
            error
          );


          /*
            Keep existing stats visible
            if a background refresh fails.
          */

          setError(
            String(error)
          );


        } finally {

          setLoading(false);

          setRefreshing(false);

          requestInProgress.current =
            false;

        }

      },
      []
    );


  /* ======================================
     LOAD STATS WHEN USERNAME CHANGES
  ====================================== */

  useEffect(() => {

    if (!username) {
      return;
    }


    loadStats(
      username,
      false
    );

  }, [
    username,
    loadStats,
  ]);


  /* ======================================
     AUTOMATIC REFRESH — EVERY 5 MINUTES
  ====================================== */

  useEffect(() => {

    if (!username) {
      return;
    }


    const intervalId =
      window.setInterval(
        () => {

          loadStats(
            username,
            true
          );

        },
        AUTO_REFRESH_INTERVAL
      );


    /*
      Remove the old timer when:
      - username changes
      - component is destroyed
    */

    return () => {

      window.clearInterval(
        intervalId
      );

    };

  }, [
    username,
    loadStats,
  ]);


  /* ======================================
     REFRESH WHEN APP BECOMES VISIBLE
  ====================================== */

  useEffect(() => {

    if (!username) {
      return;
    }


    function handleVisibilityChange() {

      /*
        Only continue when SolveGrid
        becomes visible.
      */

      if (
        document.visibilityState !==
        "visible"
      ) {
        return;
      }


      const now =
        Date.now();


      const timeSinceLastRefresh =
        now -
        lastSuccessfulRefresh.current;


      /*
        Only fetch if the existing
        data is at least 2 minutes old.
      */

      if (
        timeSinceLastRefresh >=
        FOCUS_REFRESH_THRESHOLD
      ) {

        loadStats(
          username,
          true
        );

      }

    }


    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );


    return () => {

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

    };

  }, [
    username,
    loadStats,
  ]);


  /* ======================================
     CLOSE CONTEXT MENU
  ====================================== */

  useEffect(() => {

    function closeContextMenu() {

      setContextMenu(null);

    }


    window.addEventListener(
      "click",
      closeContextMenu
    );


    window.addEventListener(
      "blur",
      closeContextMenu
    );


    return () => {

      window.removeEventListener(
        "click",
        closeContextMenu
      );


      window.removeEventListener(
        "blur",
        closeContextMenu
      );

    };

  }, []);


  /* ======================================
     USERNAME SUBMIT
  ====================================== */

  function handleUsernameSubmit(
    event: FormEvent
  ) {

    event.preventDefault();


    const cleanUsername =
      usernameInput.trim();


    if (!cleanUsername) {

      setError(
        "Enter a LeetCode username."
      );

      return;

    }


    setError(null);


    setUsername(
      cleanUsername
    );

  }


  /* ======================================
     OPEN LEETCODE PROFILE
  ====================================== */

  async function openLeetCodeProfile() {

    /*
      Close the custom context menu.
    */

    setContextMenu(null);


    if (!username) {
      return;
    }


    /*
      Dynamically create the profile URL
      for the currently configured user.
    */

    const profileUrl =
      `https://leetcode.com/u/${encodeURIComponent(
        username
      )}/`;


    try {

      /*
        Opens the URL in the user's
        default web browser.
      */

      await openUrl(
        profileUrl
      );


    } catch (error) {

      console.error(
        "Failed to open LeetCode profile:",
        error
      );

    }

  }


  /* ======================================
     MANUAL REFRESH
  ====================================== */

  async function refreshProgress() {

    setContextMenu(null);


    if (
      !username ||
      refreshing
    ) {
      return;
    }


    await loadStats(
      username,
      true
    );

  }


  /* ======================================
     CHANGE USERNAME
  ====================================== */

  function changeUsername() {

    setContextMenu(null);


    /*
      Remove the saved username.
    */

    localStorage.removeItem(
      USERNAME_STORAGE_KEY
    );


    /*
      Reset all user-specific state.
    */

    setUsername("");

    setUsernameInput("");

    setStats(null);

    setError(null);


    lastSuccessfulRefresh.current =
      0;

  }


  /* ======================================
     SYNC SETTINGS WITH TAURI
  ====================================== */

  useEffect(() => {
    invoke("sync_settings", {
      size: widgetSize,
      launchStartup: launchWithWindows,
    }).catch((err) => {
      console.error("Failed to sync settings with Rust:", err);
    });
  }, [widgetSize, launchWithWindows]);


  /* ======================================
     DYNAMIC FOCUSABLE MODE
  ====================================== */

  useEffect(() => {
    // If username is set, the widget is in desktop mode (always at bottom, not focusable).
    // If username is empty, the widget is in setup mode (focusable to type username).
    getCurrentWindow().setFocusable(!username).catch((err) => {
      console.error("Failed to toggle window focusability:", err);
    });
  }, [username]);


  /* ======================================
     LISTEN TO TAURI TRAY EVENTS
  ====================================== */

  useEffect(() => {
    const listeners: Promise<() => void>[] = [];

    listeners.push(
      listen<string>("widget-size-changed", (event) => {
        const newSize = event.payload as "small" | "medium" | "large";
        setWidgetSize(newSize);
        localStorage.setItem("solvegrid-widget-size", newSize);
      })
    );

    listeners.push(
      listen<boolean>("launch-startup-changed", (event) => {
        const newVal = event.payload;
        setLaunchWithWindows(newVal);
        localStorage.setItem("solvegrid-launch-startup", String(newVal));
      })
    );

    listeners.push(
      listen("refresh-progress", () => {
        refreshProgress();
      })
    );

    listeners.push(
      listen("open-leetcode-profile", () => {
        openLeetCodeProfile();
      })
    );

    listeners.push(
      listen("change-username", () => {
        changeUsername();
      })
    );

    return () => {
      listeners.forEach((p) => p.then((unlisten) => unlisten()));
    };
  }, [refreshProgress, openLeetCodeProfile, changeUsername]);


  /* ======================================
     CUSTOM RIGHT-CLICK MENU
  ====================================== */

  function openContextMenu(
    event: MouseEvent<HTMLElement>
  ) {

    /*
      Prevent the normal browser/WebView
      context menu from appearing.
    */

    event.preventDefault();


    const menuWidth =
      190;


    /*
      The menu is taller now because
      Open LeetCode Profile was added.
    */

    const menuHeight =
      155;


    /*
      Keep the menu inside
      the widget window.
    */

    const x =
      Math.min(
        event.clientX,
        window.innerWidth -
        menuWidth -
        12
      );


    const y =
      Math.min(
        event.clientY,
        window.innerHeight -
        menuHeight -
        12
      );


    setContextMenu({

      x:
        Math.max(
          12,
          x
        ),

      y:
        Math.max(
          12,
          y
        ),

    });

  }


  /* ======================================
     WINDOW DRAGGING
  ====================================== */

  async function startDragging(
    event:
      React.MouseEvent<HTMLElement>
  ) {

    /*
      Only allow dragging with
      the primary/left mouse button.
    */

    if (
      event.button !== 0 || positionLocked
    ) {
      return;
    }


    const target =
      event.target as HTMLElement;


    /*
      Do not drag the native window
      while the user is interacting
      with controls.
    */

    if (
      target.closest(
        `
          input,
          button,
          .activity-cell,
          .context-menu
        `
      )
    ) {
      return;
    }


    try {

      await getCurrentWindow()
        .startDragging();


    } catch (error) {

      console.error(
        "Failed to drag window:",
        error
      );

    }

  }


  /* ======================================
     SCALE STYLE FOR WIDGET SIZE
  ====================================== */

  const getScaleStyle = () => {
    switch (widgetSize) {
      case "small":
        return { transform: "scale(0.473, 0.435)", transformOrigin: "top left" };
      case "medium":
        return { transform: "scale(0.552, 0.512)", transformOrigin: "top left" };
      case "large":
        return { transform: "scale(0.657, 0.615)", transformOrigin: "top left" };
      default:
        return { transform: "scale(0.552, 0.512)", transformOrigin: "top left" };
    }
  };


  /* ======================================
     FIRST-LAUNCH SETUP
  ====================================== */

  if (!username) {

    return (

      <main className="app" style={getScaleStyle()}>

        <section
          className="widget setup-widget"
          onMouseDown={
            startDragging
          }
        >

          <div className="setup-content">


            <div className="setup-logo">

              SG

            </div>


            <h1 className="setup-title">

              Welcome to SolveGrid

            </h1>


            <p className="setup-description">

              Enter your LeetCode username
              to start tracking your progress.

            </p>


            <form
              className="setup-form"
              onSubmit={
                handleUsernameSubmit
              }
            >

              <input
                className="username-input"

                type="text"

                value={
                  usernameInput
                }

                onChange={
                  (event) =>
                    setUsernameInput(
                      event.target.value
                    )
                }

                placeholder="LeetCode username"

                autoFocus

                spellCheck={
                  false
                }
              />


              <button
                className="continue-button"
                type="submit"
              >

                Continue

              </button>

            </form>


            {error && (

              <p className="setup-error">

                {error}

              </p>

            )}


          </div>

        </section>

      </main>

    );

  }


  /* ======================================
     INITIAL LOADING
  ====================================== */

  if (
    loading &&
    !stats
  ) {

    return (

      <main className="app" style={getScaleStyle()}>

        <section
          className="widget status-widget"
          onMouseDown={
            startDragging
          }
        >

          <div className="loading-dot" />


          <p className="status-message">

            Loading progress...

          </p>

        </section>

      </main>

    );

  }


  /* ======================================
     INITIAL LOAD ERROR
  ====================================== */

  if (
    error &&
    !stats
  ) {

    return (

      <main className="app" style={getScaleStyle()}>

        <section
          className="widget status-widget"
          onMouseDown={
            startDragging
          }
        >

          <p className="status-title">

            Couldn't load progress

          </p>


          <p className="status-message">

            {error}

          </p>


          <button
            className="secondary-button"
            onClick={
              changeUsername
            }
          >

            Change username

          </button>

        </section>

      </main>

    );

  }


  /*
    This should only happen briefly
    during state transitions.
  */

  if (!stats) {

    return null;

  }


  /* ======================================
     CALCULATE DIFFICULTY RINGS
  ====================================== */

  const easyDegrees =
    getProgressDegrees(

      stats
        .difficulty
        .easy,

      stats
        .difficultyTotals
        .easy

    );


  const mediumDegrees =
    getProgressDegrees(

      stats
        .difficulty
        .medium,

      stats
        .difficultyTotals
        .medium

    );


  const hardDegrees =
    getProgressDegrees(

      stats
        .difficulty
        .hard,

      stats
        .difficultyTotals
        .hard

    );

  const { todaySolved, streak } = getSubmissionStats(stats.submissionCalendar);




  /* ======================================
     MAIN WIDGET
  ====================================== */

  return (

    <main className="app" style={getScaleStyle()}>


      <section
        className="widget"

        onMouseDown={
          startDragging
        }

        onContextMenu={
          openContextMenu
        }
      >


        {/* ================================
            HEADER
        ================================= */}


        <header className="widget-header">


          <div className="progress-info">


            <div className="title-row">


              <h1>

                Progress

              </h1>


              {refreshing && (

                <span className="refresh-status">

                  Updating

                </span>

              )}


            </div>


            <div className="progress-count">


              <span className="solved">

                {
                  stats
                    .totalSolved
                }

              </span>


              <span className="total">

                /{" "}

                {
                  stats
                    .totalProblems
                    .toLocaleString()
                }

              </span>


            </div>


          </div>


          {/* ==============================
              LARGE STATS COLUMN (STREAK, TODAY, UPDATED)
          =============================== */}

          {widgetSize === "large" && (
            <div className="large-stats-column">
              <div className="large-stat-item">
                <span className="stat-label">TODAY</span>
                <span className="stat-value">{todaySolved}</span>
              </div>
              <div className="large-stat-item">
                <span className="stat-label">STREAK</span>
                <span className="stat-value">{streak} <span className="streak-suffix">days</span></span>
              </div>
              <div className="large-stat-item">
                <span className="stat-label">UPDATED</span>
                <span className="stat-value">{lastUpdated || "N/A"}</span>
              </div>
            </div>
          )}


          {/* ==============================
              DIFFICULTY RINGS
          =============================== */}


          {widgetSize !== "small" && (
            <div
              className="activity-rings"

              title={
                `Easy: ${stats.difficulty.easy} · ` +
                `Medium: ${stats.difficulty.medium} · ` +
                `Hard: ${stats.difficulty.hard}`
              }
            >


              {/* EASY — GREEN */}


              <div
                className="ring ring-outer"

                style={{
                  background:
                    `conic-gradient(
                      from -42deg,

                      #35df77 0deg,

                      #35df77
                      ${easyDegrees}deg,

                      #173522
                      ${easyDegrees}deg,

                      #173522 360deg
                    )`,
                }}
              >


                {/* MEDIUM — YELLOW */}


                <div
                  className="ring ring-middle"

                  style={{
                    background:
                      `conic-gradient(
                        from -42deg,

                        #f4c542 0deg,

                        #f4c542
                        ${mediumDegrees}deg,

                        #443816
                        ${mediumDegrees}deg,

                        #443816 360deg
                      )`,
                  }}
                >


                  {/* HARD — RED */}


                  <div
                    className="ring ring-inner"

                    style={{
                      background:
                        `conic-gradient(
                          from -42deg,

                          #ef5350 0deg,

                          #ef5350
                          ${hardDegrees}deg,

                          #431b1b
                          ${hardDegrees}deg,

                          #431b1b 360deg
                        )`,
                    }}
                  >


                    <div
                      className="ring-core"
                    />


                  </div>


                </div>


              </div>


            </div>
          )}

        </header>


        {/* ================================
            REAL LEETCODE HEATMAP
        ================================= */}


        <ActivityHeatmap

          submissionCalendar={
            stats
              .submissionCalendar
          }

        />


        {/* ================================
            NON-BLOCKING REFRESH ERROR
        ================================= */}


        {error && (

          <div className="refresh-error">

            Refresh failed — showing
            your previous data.

          </div>

        )}


      </section>


      {/* ==================================
          CUSTOM RIGHT-CLICK MENU
      ================================== */}


      {contextMenu && (

        <div
          className="context-menu"

          style={{
            left:
              contextMenu.x,

            top:
              contextMenu.y,
          }}

          onMouseDown={
            (event) =>
              event.stopPropagation()
          }

          onClick={
            (event) =>
              event.stopPropagation()
          }
        >


          {/* OPEN LEETCODE */}


          <button
            className="context-menu-item"

            onClick={
              openLeetCodeProfile
            }
          >

            Open LeetCode profile

          </button>


          <div
            className="context-menu-divider"
          />


          {/* REFRESH */}


          <button
            className="context-menu-item"

            onClick={
              refreshProgress
            }

            disabled={
              refreshing
            }
          >


            <span>

              Refresh progress

            </span>


            {refreshing && (

              <span
                className="mini-spinner"
              />

            )}


          </button>


          <div
            className="context-menu-divider"
          />


          {/* CHANGE USERNAME */}


          <button
            className="context-menu-item"

            onClick={
              changeUsername
            }
          >

            Change username

          </button>


          <div
            className="context-menu-divider"
          />


          {/* LOCK / UNLOCK POSITION */}


          <button
            className="context-menu-item"

            onClick={
              () => {
                const newLock = !positionLocked;
                setPositionLocked(newLock);
                localStorage.setItem("solvegrid-position-locked", String(newLock));
                setContextMenu(null);
              }
            }
          >

            {positionLocked ? "Unlock position" : "Lock position"}

          </button>

        </div>

      )}


    </main>

  );

}


export default App;