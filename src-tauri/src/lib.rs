use serde::{Deserialize, Serialize};
use serde_json::json;

use std::fs::File;
use std::io::{Read, Write};
use std::time::Duration;

use tauri::{
    menu::{Menu, MenuItem, Submenu, CheckMenuItem},
    tray::{
        MouseButton,
        MouseButtonState,
        TrayIconBuilder,
        TrayIconEvent,
    },
    Manager,
    PhysicalPosition,
    WebviewWindow,
    Emitter,
};



/* ========================================
   CONSTANTS
======================================== */

const LEETCODE_GRAPHQL_URL: &str =
    "https://leetcode.com/graphql";

const REQUEST_TIMEOUT_SECONDS: u64 =
    15;

const MAX_USERNAME_LENGTH: usize =
    64;


/* ========================================
   LEETCODE DATA TYPES
======================================== */

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DifficultyStats {
    easy: i32,
    medium: i32,
    hard: i32,
}


#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DifficultyTotals {
    easy: i32,
    medium: i32,
    hard: i32,
}


#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LeetCodeStats {
    username: String,

    total_solved: i32,
    total_problems: i32,

    difficulty: DifficultyStats,
    difficulty_totals: DifficultyTotals,

    submission_calendar: String,
}


/* ========================================
   GRAPHQL RESPONSE TYPES
======================================== */

#[derive(Debug, Deserialize)]
struct GraphQLResponse {
    data: Option<GraphQLData>,
    errors: Option<Vec<GraphQLError>>,
}


#[derive(Debug, Deserialize)]
struct GraphQLError {
    message: String,
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GraphQLData {
    matched_user: Option<MatchedUser>,
    all_questions_count: Vec<QuestionCount>,
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MatchedUser {
    submit_stats: SubmitStats,
    submission_calendar: String,
}


#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitStats {
    ac_submission_num: Vec<SubmissionCount>,
}


#[derive(Debug, Deserialize)]
struct SubmissionCount {
    difficulty: String,
    count: i32,
}


#[derive(Debug, Deserialize)]
struct QuestionCount {
    difficulty: String,
    count: i32,
}


/* ========================================
   WIDGET POSITION & AUTOSTART
======================================== */

#[derive(Debug, Serialize, Deserialize, Clone)]
struct WindowState {
    x: i32,
    y: i32,
}

fn save_window_position(app_handle: &tauri::AppHandle, position: PhysicalPosition<i32>) {
    if let Ok(mut config_dir) = app_handle.path().app_config_dir() {
        let _ = std::fs::create_dir_all(&config_dir);
        config_dir.push("window-state.json");
        let state = WindowState { x: position.x, y: position.y };
        if let Ok(state_json) = serde_json::to_string(&state) {
            if let Ok(mut file) = File::create(config_dir) {
                let _ = file.write_all(state_json.as_bytes());
            }
        }
    }
}

fn restore_window_position(window: &WebviewWindow) {
    let app_handle = window.app_handle();
    if let Ok(mut config_dir) = app_handle.path().app_config_dir() {
        config_dir.push("window-state.json");
        if config_dir.exists() {
            if let Ok(mut file) = File::open(config_dir) {
                let mut contents = String::new();
                if file.read_to_string(&mut contents).is_ok() {
                    if let Ok(state) = serde_json::from_str::<WindowState>(&contents) {
                        let _ = window.set_position(PhysicalPosition::new(state.x, state.y));
                    }
                }
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn set_autostart<R: tauri::Runtime>(_app_handle: &tauri::AppHandle<R>, enable: bool) -> Result<(), String> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_SET_VALUE};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows\CurrentVersion\Run";
    
    let key = hkcu.open_subkey_with_flags(path, KEY_SET_VALUE)
        .map_err(|e| format!("Failed to open registry key: {}", e))?;

    let app_exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {}", e))?;
    
    let app_name = "SolveGrid";

    if enable {
        let value = format!("\"{}\" --silent", app_exe_path.to_string_lossy());
        key.set_value(app_name, &value.as_str())
            .map_err(|e| format!("Failed to set registry value: {}", e))?;
    } else {
        let _ = key.delete_value(app_name);
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn set_autostart<R: tauri::Runtime>(_app_handle: &tauri::AppHandle<R>, _enable: bool) -> Result<(), String> {
    Ok(())
}

#[cfg(target_os = "windows")]
fn is_autostart_enabled() -> bool {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = r"Software\Microsoft\Windows\CurrentVersion\Run";
    
    if let Ok(key) = hkcu.open_subkey_with_flags(path, KEY_READ) {
        let app_name = "SolveGrid";
        return key.get_value::<String, _>(app_name).is_ok();
    }
    false
}

#[cfg(not(target_os = "windows"))]
fn is_autostart_enabled() -> bool {
    false
}

#[tauri::command]
fn toggle_autostart(app_handle: tauri::AppHandle, enable: bool) -> Result<bool, String> {
    set_autostart(&app_handle, enable)?;
    Ok(is_autostart_enabled())
}

#[tauri::command]
fn check_autostart() -> bool {
    is_autostart_enabled()
}


/* ========================================
   USERNAME VALIDATION
======================================== */

fn validate_username(
    username: String,
) -> Result<String, String> {

    /*
      Remove accidental spaces from
      the beginning and end.
    */

    let username =
        username
            .trim()
            .to_string();


    /*
      Reject empty usernames.
    */

    if username.is_empty() {

        return Err(
            "Username cannot be empty."
                .to_string()
        );

    }


    /*
      Prevent excessively large input
      from reaching the network layer.
    */

    if username.len() >
        MAX_USERNAME_LENGTH
    {

        return Err(
            "Username is too long."
                .to_string()
        );

    }


    /*
      Only allow characters expected
      in a normal LeetCode username.

      This validation happens inside
      the Rust backend, so it does not
      rely only on the React frontend.
    */

    let valid =
        username
            .chars()
            .all(
                |character| {

                    character
                        .is_ascii_alphanumeric()

                        ||

                    character == '-'

                        ||

                    character == '_'

                }
            );


    if !valid {

        return Err(
            "Username contains invalid characters."
                .to_string()
        );

    }


    Ok(username)
}


/* ========================================
   GET LEETCODE STATS
======================================== */

#[tauri::command]
async fn get_leetcode_stats(
    username: String,
) -> Result<LeetCodeStats, String> {

    /* ====================================
       VALIDATE NATIVE COMMAND INPUT
    ==================================== */

    let username =
        validate_username(
            username
        )?;


    /* ====================================
       GRAPHQL QUERY
    ==================================== */

    let query = r#"
        query userProfile($username: String!) {

            allQuestionsCount {
                difficulty
                count
            }

            matchedUser(username: $username) {

                submitStats: submitStatsGlobal {
                    acSubmissionNum {
                        difficulty
                        count
                        submissions
                    }
                }

                submissionCalendar
            }
        }
    "#;


    /*
      The username is passed as a
      GraphQL variable rather than
      being inserted directly into
      the GraphQL query.
    */

    let body = json!({

        "query": query,

        "variables": {
            "username":
                username.clone()
        }

    });


    /* ====================================
       HTTP CLIENT
    ==================================== */

    let client =
        reqwest::Client::builder()

            /*
              Prevent a request from
              remaining pending forever.
            */

            .timeout(
                Duration::from_secs(
                    REQUEST_TIMEOUT_SECONDS
                )
            )

            .build()

            .map_err(
                |_| {

                    "Could not prepare the network request."
                        .to_string()

                }
            )?;


    /* ====================================
       SEND REQUEST
    ==================================== */

    let response =
        client

            .post(
                LEETCODE_GRAPHQL_URL
            )

            .header(
                "Content-Type",
                "application/json"
            )

            .header(
                "Referer",
                "https://leetcode.com"
            )

            .header(
                "User-Agent",
                "SolveGrid/0.1"
            )

            .json(
                &body
            )

            .send()

            .await

            .map_err(
                |_| {

                    /*
                      Do not expose raw
                      reqwest/internal
                      network errors to
                      the frontend.
                    */

                    "Could not connect to LeetCode. Please try again."
                        .to_string()

                }
            )?;


    /* ====================================
       CHECK HTTP STATUS
    ==================================== */

    if !response
        .status()
        .is_success()
    {

        /*
          Avoid exposing unnecessary
          implementation details.

          The exact status can still
          be logged during development
          later if required.
        */

        return Err(
            "LeetCode could not process the request. Please try again."
                .to_string()
        );

    }


    /* ====================================
       PARSE GRAPHQL RESPONSE
    ==================================== */

    let graphql_response =
        response

            .json::<GraphQLResponse>()

            .await

            .map_err(
                |_| {

                    /*
                      Do not expose raw
                      JSON parsing errors.
                    */

                    "LeetCode returned an unexpected response."
                        .to_string()

                }
            )?;


    /* ====================================
       HANDLE GRAPHQL ERRORS
    ==================================== */

    if let Some(errors) =
        graphql_response.errors
    {

        /*
          GraphQL errors can contain
          upstream implementation details.

          Keep the message generic for
          the application user.
        */

        if !errors.is_empty() {

            return Err(
                "LeetCode could not process the request."
                    .to_string()
            );

        }

    }


    /* ====================================
       GET GRAPHQL DATA
    ==================================== */

    let data =
        graphql_response

            .data

            .ok_or_else(
                || {

                    "LeetCode returned no data."
                        .to_string()

                }
            )?;


    /* ====================================
       FIND USER
    ==================================== */

    let user =
        data

            .matched_user

            .ok_or_else(
                || {

                    format!(
                        "LeetCode user '{}' was not found.",
                        username
                    )

                }
            )?;


    /* ====================================
       USER SOLVED COUNTS
    ==================================== */

    let mut total_solved =
        0;

    let mut easy =
        0;

    let mut medium =
        0;

    let mut hard =
        0;


    for stat in
        user
            .submit_stats
            .ac_submission_num
    {

        match
            stat
                .difficulty
                .as_str()
        {

            "All" => {

                total_solved =
                    stat.count;

            }


            "Easy" => {

                easy =
                    stat.count;

            }


            "Medium" => {

                medium =
                    stat.count;

            }


            "Hard" => {

                hard =
                    stat.count;

            }


            _ => {}

        }

    }


    /* ====================================
       TOTAL LEETCODE PROBLEM COUNTS
    ==================================== */

    let mut total_problems =
        0;

    let mut total_easy =
        0;

    let mut total_medium =
        0;

    let mut total_hard =
        0;


    for stat in
        data
            .all_questions_count
    {

        match
            stat
                .difficulty
                .as_str()
        {

            "All" => {

                total_problems =
                    stat.count;

            }


            "Easy" => {

                total_easy =
                    stat.count;

            }


            "Medium" => {

                total_medium =
                    stat.count;

            }


            "Hard" => {

                total_hard =
                    stat.count;

            }


            _ => {}

        }

    }


    /* ====================================
       RETURN DATA TO REACT
    ==================================== */

    Ok(
        LeetCodeStats {

            username,

            total_solved,

            total_problems,


            difficulty:
                DifficultyStats {

                    easy,

                    medium,

                    hard,

                },


            difficulty_totals:
                DifficultyTotals {

                    easy:
                        total_easy,

                    medium:
                        total_medium,

                    hard:
                        total_hard,

                },


            submission_calendar:
                user
                    .submission_calendar,

        }
    )
}



struct TrayMenuState<R: tauri::Runtime> {
    size_small: CheckMenuItem<R>,
    size_medium: CheckMenuItem<R>,
    size_large: CheckMenuItem<R>,
    launch_startup: CheckMenuItem<R>,
}

#[tauri::command]
fn sync_settings<R: tauri::Runtime>(
    app_handle: tauri::AppHandle<R>,
    menu_state: tauri::State<'_, TrayMenuState<R>>,
    size: String,
    launch_startup: bool,
) -> Result<(), String> {
    let window = app_handle.get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;

    let (width, height) = match size.as_str() {
        "small" => (360.0, 170.0),
        "medium" => (420.0, 200.0),
        "large" => (500.0, 240.0),
        _ => (420.0, 200.0),
    };

    window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
        .map_err(|e| format!("Failed to set window size: {}", e))?;
    window.set_always_on_top(false)
        .map_err(|e| format!("Failed to disable always on top: {}", e))?;
    
    let _ = set_autostart(&app_handle, launch_startup);

    let _ = menu_state.size_small.set_checked(size == "small");
    let _ = menu_state.size_medium.set_checked(size == "medium");
    let _ = menu_state.size_large.set_checked(size == "large");
    let _ = menu_state.launch_startup.set_checked(launch_startup);

    Ok(())
}


/* ========================================
   START SOLVEGRID
======================================== */

#[cfg_attr(
    mobile,
    tauri::mobile_entry_point
)]
pub fn run() {

    tauri::Builder::default()


        /* =================================
           PLUGINS
        ================================= */

        .plugin(
            tauri_plugin_opener::init()
        )


        /* =================================
           SYSTEM TRAY
        ================================= */

        .setup(
            |app| {
                let window = app.get_webview_window("main").unwrap();
                restore_window_position(&window);

                let args: Vec<String> = std::env::args().collect();
                let is_silent = args.iter().any(|arg| arg == "--silent");
                if !is_silent {
                    let _ = window.show();
                }

                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    match event {
                        tauri::WindowEvent::Moved(position) => {
                            save_window_position(&window_clone.app_handle(), *position);
                        }
                        tauri::WindowEvent::Resized(size) => {
                            #[cfg(target_os = "windows")]
                            if size.width == 0 && size.height == 0 {
                                let w = window_clone.clone();
                                std::thread::spawn(move || {
                                    std::thread::sleep(std::time::Duration::from_millis(150));
                                    let _ = w.unminimize();
                                    let _ = w.show();
                                });
                            }
                            #[cfg(not(target_os = "windows"))]
                            let _ = size;
                        }
                        _ => {}
                    }
                });

                #[cfg(target_os = "windows")]
                {
                    let _ = set_autostart(app.handle(), true);
                }

                /* =================================
                   CREATE TRAY MENU ITEMS
                ================================= */

                let show_hide = MenuItem::with_id(app, "show_hide", "Show / Hide Widget", true, None::<&str>)?;
                let refresh = MenuItem::with_id(app, "refresh", "Refresh Progress", true, None::<&str>)?;
                let open_profile = MenuItem::with_id(app, "open_profile", "Open LeetCode Profile", true, None::<&str>)?;
                
                // Size Submenu
                let size_submenu = Submenu::with_id(app, "size_submenu", "Size", true)?;
                let size_small = CheckMenuItem::with_id(app, "size_small", "Small", true, false, None::<&str>)?;
                let size_medium = CheckMenuItem::with_id(app, "size_medium", "Medium", true, true, None::<&str>)?;
                let size_large = CheckMenuItem::with_id(app, "size_large", "Large", true, false, None::<&str>)?;
                size_submenu.append(&size_small)?;
                size_submenu.append(&size_medium)?;
                size_submenu.append(&size_large)?;

                // Toggle items
                let is_startup_enabled = is_autostart_enabled();
                let launch_startup = CheckMenuItem::with_id(app, "launch_startup", "Launch with Windows", true, is_startup_enabled, None::<&str>)?;
                
                let change_username = MenuItem::with_id(app, "change_username", "Change Username", true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "Quit SolveGrid", true, None::<&str>)?;

                // Separators
                let sep1 = tauri::menu::PredefinedMenuItem::separator(app)?;
                let sep2 = tauri::menu::PredefinedMenuItem::separator(app)?;
                let sep3 = tauri::menu::PredefinedMenuItem::separator(app)?;
                let sep4 = tauri::menu::PredefinedMenuItem::separator(app)?;

                let menu = Menu::with_items(
                    app,
                    &[
                        &show_hide,
                        &refresh,
                        &open_profile,
                        &sep1,
                        &size_submenu,
                        &sep2,
                        &launch_startup,
                        &sep3,
                        &change_username,
                        &sep4,
                        &quit,
                    ],
                )?;

                // Manage handles in state
                app.manage(TrayMenuState {
                    size_small: size_small.clone(),
                    size_medium: size_medium.clone(),
                    size_large: size_large.clone(),
                    launch_startup: launch_startup.clone(),
                });

                let size_small_c = size_small.clone();
                let size_medium_c = size_medium.clone();
                let size_large_c = size_large.clone();
                let launch_startup_c = launch_startup.clone();

                /* =================================
                   BUILD TRAY
                ================================= */

                TrayIconBuilder::new()
                    .icon(
                        app.default_window_icon()
                            .expect("SolveGrid app icon missing")
                            .clone()
                    )
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    
                    /* =====================
                       TRAY MENU EVENTS
                    ===================== */
                    .on_menu_event(move |app, event| {
                        match event.id().as_ref() {
                            "show_hide" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let visible = window.is_visible().unwrap_or(true);
                                    if visible {
                                        let _ = window.hide();
                                    } else {
                                        let _ = window.show();
                                    }
                                }
                            }
                            "refresh" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.emit("refresh-progress", ());
                                }
                            }
                            "open_profile" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.emit("open-leetcode-profile", ());
                                }
                            }
                            "size_small" => {
                                let _ = size_small_c.set_checked(true);
                                let _ = size_medium_c.set_checked(false);
                                let _ = size_large_c.set_checked(false);
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(360.0, 170.0)));
                                    let _ = window.emit("widget-size-changed", "small");
                                }
                            }
                            "size_medium" => {
                                let _ = size_small_c.set_checked(false);
                                let _ = size_medium_c.set_checked(true);
                                let _ = size_large_c.set_checked(false);
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(420.0, 200.0)));
                                    let _ = window.emit("widget-size-changed", "medium");
                                }
                            }
                            "size_large" => {
                                let _ = size_small_c.set_checked(false);
                                let _ = size_medium_c.set_checked(false);
                                let _ = size_large_c.set_checked(true);
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize::new(500.0, 240.0)));
                                    let _ = window.emit("widget-size-changed", "large");
                                }
                            }
                            "launch_startup" => {
                                if let Ok(checked) = launch_startup_c.is_checked() {
                                    let new_checked = !checked;
                                    let _ = launch_startup_c.set_checked(new_checked);
                                    let _ = set_autostart(app, new_checked);
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ = window.emit("launch-startup-changed", new_checked);
                                    }
                                }
                            }
                            "change_username" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.emit("change-username", ());
                                }
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    /* =====================
                       LEFT-CLICK TRAY ICON
                    ===================== */
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                            }
                        }
                    })
                    .build(app)?;


                Ok(())

            }

        )


        /* =================================
           TAURI COMMANDS
        ================================= */

        .invoke_handler(

            tauri::generate_handler![

                get_leetcode_stats,
                toggle_autostart,
                check_autostart,
                sync_settings

            ]

        )


        /* =================================
           RUN APPLICATION
        ================================= */

        .run(
            tauri::generate_context!()
        )


        .expect(
            "error while running SolveGrid"
        );

}