from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "personal.db"
GUITAR_FILES_DIR = DATA_DIR / "guitar_files"

DEFAULT_HABITS = [
    ("Creatine", 1),
    ("Meditate", 2),
    ("Logged Food", 3),
    ("Guitar", 4),
    ("Exercise", 5),
    ("Journaling", 6),
]

DEFAULT_GUITAR_SECTIONS = [
    "Classical",
    "Blues",
    "Jazz",
    "Country",
    "Speed Sequences",
    "Solo w/ Backtracks",
    "Arps",
    "CAGED",
]

DEFAULT_GUITAR_MATERIALS = [
    "Ear Training",
    "Classical",
    "Delta Blues",
    "Speed Sequences",
    "Arps",
    "CAGED",
    "Songs",
]

DEFAULT_GUITAR_SONG_GROUPS = [
    "Blues",
    "Country",
    "Jazz",
    "Delta Blues",
    "Hendrix",
]

DEFAULT_WORKOUT_SECTIONS = [
    "Legs",
    "Chest",
    "Back",
    "Biceps",
    "Triceps",
    "Shoulders",
    "Climbing",
    "Volleyball",
    "Tennis",
    "Run",
]

LEGACY_WORKOUT_SECTIONS = [
    "Push",
    "Pull",
    "Core",
    "Basketball",
    "Recovery/Cardio",
]

LEGACY_GUITAR_SECTIONS = [
    "Scales",
    "Improvisation",
    "Songs",
    "Ear Training",
    "Theory",
    "Technique",
]

DEFAULT_FINANCE_CATEGORIES = [
    "Food",
    "Coffee",
    "Transportation",
    "Travel",
    "Rent",
    "Groceries",
    "Shopping",
    "Health",
    "Subscriptions",
    "Entertainment",
    "Gifts",
    "Other",
]

DEFAULT_REFLECTION_QUOTES = [
    ("The soul becomes dyed with the color of its thoughts.", "Marcus Aurelius"),
    ("How we spend our days is, of course, how we spend our lives.", "Annie Dillard"),
    (
        "There is nothing noble in being superior to your fellow man; true nobility is being superior to your former self.",
        "Ernest Hemingway",
    ),
    (
        "Between stimulus and response there is a space. In that space is our power to choose our response.",
        "Viktor Frankl",
    ),
    ("No mud, no lotus.", "Thich Nhat Hanh"),
    ("The obstacle is the way.", "Marcus Aurelius"),
    ("The quieter you become, the more you can hear.", "Ram Dass"),
    ("Attention is the rarest and purest form of generosity.", "Simone Weil"),
    ("He who has a why to live can bear almost any how.", "Friedrich Nietzsche"),
    ("Real change is often quiet before it is visible.", "Unknown"),
    ("A disciplined mind brings happiness.", "The Buddha"),
    ("Wherever you are, be there totally.", "Eckhart Tolle"),
]

DEFAULT_REFLECTION_PROMPTS = [
    "Take five slow breaths. On each exhale, unclench one thing you are carrying.",
    "What are you making heavier in your mind than it needs to be right now?",
    "If today only needed one good decision, what would it be?",
    "Notice your body first. Where is the tension, and what would soften it by 5%?",
    "What are you trying to rush that would benefit from five calmer minutes?",
    "Name one thing that is already enough in this moment.",
    "What would it look like to meet today with steadiness instead of pressure?",
    "Which thought has been circling lately, and what happens if you stop feeding it?",
    "What can you release before the next hour begins?",
    "If your nervous system could ask for one kindness right now, what would it be?",
    "What are you carrying for other people that may not be yours to hold?",
    "What pace would feel human today, not just productive?",
]

DEFAULT_REFLECTION_QUESTIONS = [
    "What do you want more of in your life that your current schedule does not actually protect?",
    "Are you chasing clarity, or are you avoiding commitment by waiting for perfect clarity?",
    "What would your future self thank you for doing repeatedly, even when it feels small?",
    "Which belief about yourself are you still acting from that may no longer be true?",
    "What part of your ambition is deeply yours, and what part was inherited from other people?",
    "If nobody could applaud this decision, would you still make it?",
    "What keeps getting your attention for a reason you have not fully admitted yet?",
    "Where in your life are you asking for certainty when courage would be enough?",
    "What are you optimizing that may not matter as much as you think?",
    "What would integrity look like in your next difficult conversation?",
    "What do you keep saying you value that your calendar quietly disagrees with?",
    "What are you postponing until you feel ready, even though readiness may come after action?",
]

DEFAULT_REFLECTION_VIDEOS = [
    ("Flower", "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"),
    ("Rain", "https://www.w3schools.com/howto/rain.mp4"),
    ("Big Buck Bunny", "https://www.w3schools.com/html/mov_bbb.mp4"),
    ("Joyrides", "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"),
]

# To add a new company: append to the END of this list.
# The frontend appends unknown companies to the bottom of the user's saved order,
# so adding here won't reset anyone's existing organization or favorites.
# source_type = "none" means no ATS scraper — company appears in the unified company
# list for networking/cowork reference but is hidden from the internships sidebar.
DEFAULT_TRACKED_COMPANIES = [
    # (name, source_type, source_key, careers_url, category)

    # ── AI ─────────────────────────────────────────────────────────────────
    ("Anthropic", "greenhouse", "anthropic", "https://www.anthropic.com/careers", "AI"),
    ("OpenAI", "none", "", "https://openai.com/careers", "AI"),
    ("Google DeepMind", "none", "", "https://deepmind.google/careers", "AI"),
    ("Cohere", "none", "", "https://cohere.com/about/careers", "AI"),
    ("Adept AI", "none", "", "https://www.adept.ai/careers", "AI"),
    ("Perplexity AI", "none", "", "https://www.perplexity.ai/careers", "AI"),
    ("World Labs", "none", "", "https://www.worldlabs.ai/careers", "AI"),
    ("Mithril", "none", "", "", "AI"),
    ("Suno", "none", "", "https://suno.com/careers", "AI"),
    ("Scale AI", "greenhouse", "scaleai", "https://scale.com/careers", "AI"),
    ("Cursor", "none", "", "https://www.cursor.com/careers", "AI"),

    # ── Big Tech ──────────────────────────────────────────────────────────
    ("Google", "none", "", "https://careers.google.com", "Big Tech"),
    ("Meta", "none", "", "https://www.metacareers.com", "Big Tech"),
    ("Microsoft", "none", "", "https://careers.microsoft.com", "Big Tech"),
    ("Amazon", "none", "", "https://www.amazon.jobs", "Big Tech"),
    ("NVIDIA", "workday", "nvidia/wd5/NVIDIAExternalCareerSite", "https://www.nvidia.com/en-us/about-nvidia/careers", "Big Tech"),
    ("Apple", "none", "", "https://www.apple.com/careers", "Big Tech"),
    ("Uber", "none", "", "https://www.uber.com/us/en/careers", "Big Tech"),
    ("Stripe", "greenhouse", "stripe", "https://stripe.com/jobs", "Big Tech"),
    ("Databricks", "greenhouse", "databricks", "https://www.databricks.com/company/careers/open-positions", "Big Tech"),

    # ── Robotics ─────────────────────────────────────────────────────────
    ("Boston Dynamics", "none", "", "https://www.bostondynamics.com/careers", "Robotics"),
    ("Walt Disney Imagineering", "none", "", "https://jobs.disneycareers.com", "Robotics"),
    ("Figure AI", "none", "", "https://www.figure.ai/careers", "Robotics"),
    ("Agility Robotics", "none", "", "https://agilityrobotics.com/careers", "Robotics"),
    ("Apptronik", "greenhouse", "apptronik", "https://apptronik.com/careers", "Robotics"),
    ("Skild AI", "none", "", "https://www.skild.ai/careers", "Robotics"),
    ("Physical Intelligence", "none", "", "https://www.physicalintelligence.company/careers", "Robotics"),
    ("Rhoda AI", "none", "", "", "Robotics"),
    ("Standard Bots", "none", "", "https://standardbots.com/careers", "Robotics"),
    ("Pickle Robot Company", "none", "", "https://www.pickeadam.com/careers", "Robotics"),
    ("Chef Robotics", "none", "", "https://www.chefrobotics.ai/careers", "Robotics"),
    ("Neuralink", "greenhouse", "neuralink", "https://neuralink.com/careers", "Robotics"),

    # ── Autonomous Vehicles / Drones ──────────────────────────────────────
    ("Tesla", "tesla", "tesla", "https://www.tesla.com/careers", "Autonomous Vehicles / Drones"),
    ("Waymo", "greenhouse", "waymo", "https://waymo.com/careers", "Autonomous Vehicles / Drones"),
    ("Zipline", "greenhouse", "flyzipline", "https://www.zipline.com/careers/open-roles", "Autonomous Vehicles / Drones"),
    ("Skydio", "none", "", "https://www.skydio.com/pages/careers", "Autonomous Vehicles / Drones"),
    ("Shield AI", "lever", "shieldai", "https://shield.ai/careers", "Autonomous Vehicles / Drones"),
    ("Saildrone", "none", "", "https://www.saildrone.com/careers", "Autonomous Vehicles / Drones"),
    ("Percepto", "none", "", "https://percepto.co/careers", "Autonomous Vehicles / Drones"),
    ("Archer", "greenhouse", "archer56", "https://www.archer.com/careers", "Autonomous Vehicles / Drones"),
    ("Nuro", "greenhouse", "nuro", "https://www.nuro.ai/careers", "Autonomous Vehicles / Drones"),

    # ── Space ─────────────────────────────────────────────────────────────
    ("SpaceX", "greenhouse", "spacex", "https://www.spacex.com/careers", "Space"),
    ("Blue Origin", "none", "", "https://www.blueorigin.com/careers", "Space"),
    ("Relativity Space", "none", "", "https://www.relativityspace.com/careers", "Space"),
    ("Astrobotic", "none", "", "https://www.astrobotic.com/careers", "Space"),
    ("Voyager Technologies", "none", "", "https://www.voyagertechnologies.com/careers", "Space"),

    # ── Defense / Autonomy ────────────────────────────────────────────────
    ("Anduril", "greenhouse", "andurilindustries", "https://www.anduril.com/open-roles", "Defense / Autonomy"),
    ("Palantir", "none", "", "https://www.palantir.com/careers", "Defense / Autonomy"),

    # ── Climate Tech / Robotics ───────────────────────────────────────────
    ("Heirloom", "none", "", "https://www.heirloomcarbon.com/careers", "Climate Tech / Robotics"),
    ("Charm Industrial", "none", "", "https://www.charmindustrial.com/careers", "Climate Tech / Robotics"),
    ("Twelve", "none", "", "https://www.twelve.co/careers", "Climate Tech / Robotics"),
    ("Carbon Robotics", "none", "", "https://carbonrobotics.com/careers", "Climate Tech / Robotics"),
    ("FarmWise", "none", "", "https://farmwise.io/careers", "Climate Tech / Robotics"),
    ("AMP Robotics", "none", "", "https://amprobotics.com/careers", "Climate Tech / Robotics"),

    # ── Simulation / Graphics ─────────────────────────────────────────────
    ("Unity Technologies", "none", "", "https://careers.unity.com", "Simulation / Graphics"),
    ("Roblox", "none", "", "https://careers.roblox.com", "Simulation / Graphics"),
    ("Ansys", "none", "", "https://www.ansys.com/about-ansys/careers", "Simulation / Graphics"),

]


@contextmanager
def get_db() -> Iterator[sqlite3.Connection]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    GUITAR_FILES_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def _merge_company_alias(conn: sqlite3.Connection, legacy_name: str, canonical_name: str) -> None:
    legacy_row = conn.execute(
        """
        SELECT id
        FROM tracked_companies
        WHERE LOWER(name) = LOWER(?)
        """,
        (legacy_name,),
    ).fetchone()
    canonical_row = conn.execute(
        """
        SELECT id
        FROM tracked_companies
        WHERE LOWER(name) = LOWER(?)
        """,
        (canonical_name,),
    ).fetchone()

    legacy_id = legacy_row["id"] if legacy_row else None
    canonical_id = canonical_row["id"] if canonical_row else None

    if legacy_id and canonical_id and legacy_id != canonical_id:
        conn.execute(
            """
            DELETE FROM internship_postings
            WHERE company_id = ?
              AND external_id IN (
                SELECT external_id
                FROM internship_postings
                WHERE company_id = ?
              )
            """,
            (legacy_id, canonical_id),
        )
        conn.execute(
            "UPDATE internship_postings SET company_id = ? WHERE company_id = ?",
            (canonical_id, legacy_id),
        )
        conn.execute("DELETE FROM tracked_companies WHERE id = ?", (legacy_id,))
    elif legacy_id and not canonical_id:
        conn.execute(
            """
            UPDATE tracked_companies
            SET name = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (canonical_name, legacy_id),
        )

    conn.execute(
        """
        UPDATE networking_contacts
        SET company = ?, updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(company) = LOWER(?)
        """,
        (canonical_name, legacy_name),
    )
    conn.execute(
        """
        UPDATE potential_connects
        SET company = ?, updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(company) = LOWER(?)
        """,
        (canonical_name, legacy_name),
    )


def _backup_db() -> None:
    if not DB_PATH.exists():
        return
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = DATA_DIR / f"personal_backup_{stamp}.db"
    src = sqlite3.connect(DB_PATH)
    dst = sqlite3.connect(backup_path)
    try:
        src.backup(dst)
    finally:
        dst.close()
        src.close()


def create_schema() -> None:
    _backup_db()
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS habits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                is_active INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS habit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
                log_date TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 1,
                notes TEXT,
                UNIQUE(habit_id, log_date)
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                task_date TEXT NOT NULL,
                completed INTEGER NOT NULL DEFAULT 0,
                notes TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS checklist_trackers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                starting_count INTEGER NOT NULL DEFAULT 0,
                total_goal INTEGER NOT NULL,
                daily_goal INTEGER NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS checklist_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                checklist_id INTEGER NOT NULL REFERENCES checklist_trackers(id) ON DELETE CASCADE,
                log_date TEXT NOT NULL,
                amount INTEGER NOT NULL DEFAULT 0,
                UNIQUE(checklist_id, log_date)
            );

            CREATE TABLE IF NOT EXISTS guitar_sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS guitar_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_date TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL DEFAULT 0,
                notes TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS guitar_session_sections (
                session_id INTEGER NOT NULL REFERENCES guitar_sessions(id) ON DELETE CASCADE,
                section_id INTEGER NOT NULL REFERENCES guitar_sections(id) ON DELETE CASCADE,
                PRIMARY KEY(session_id, section_id)
            );

            CREATE TABLE IF NOT EXISTS guitar_materials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS guitar_song_groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                sort_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS guitar_songs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                group_id INTEGER NOT NULL REFERENCES guitar_song_groups(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS guitar_song_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                song_id INTEGER NOT NULL REFERENCES guitar_songs(id) ON DELETE CASCADE,
                display_name TEXT NOT NULL,
                stored_name TEXT NOT NULL,
                relative_path TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS workout_sections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS workout_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_date TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL DEFAULT 0,
                run_miles REAL,
                notes TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS workout_session_sections (
                session_id INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
                section_id INTEGER NOT NULL REFERENCES workout_sections(id) ON DELETE CASCADE,
                PRIMARY KEY(session_id, section_id)
            );

            CREATE TABLE IF NOT EXISTS networking_contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                company TEXT NOT NULL,
                role TEXT NOT NULL,
                tags_json TEXT NOT NULL DEFAULT '[]',
                email TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                linkedin TEXT NOT NULL DEFAULT '',
                location_city TEXT NOT NULL DEFAULT '',
                location_region TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                last_contact_date TEXT NOT NULL,
                next_follow_up_date TEXT,
                how_we_met TEXT NOT NULL DEFAULT '',
                next_action TEXT NOT NULL DEFAULT '',
                follow_up_type TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS networking_interactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contact_id INTEGER NOT NULL REFERENCES networking_contacts(id) ON DELETE CASCADE,
                interaction_date TEXT NOT NULL,
                interaction_type TEXT NOT NULL,
                summary TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS potential_connects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                company TEXT NOT NULL DEFAULT '',
                role TEXT NOT NULL DEFAULT '',
                linkedin TEXT NOT NULL DEFAULT '',
                focus_area TEXT NOT NULL DEFAULT '',
                connection_request TEXT NOT NULL DEFAULT '',
                outreach_type TEXT NOT NULL DEFAULT 'linkedin',
                status TEXT NOT NULL DEFAULT 'pending',
                date_added TEXT NOT NULL DEFAULT (DATE('now')),
                date_sent TEXT,
                notes TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS finance_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                sort_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS finance_expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category_id INTEGER NOT NULL REFERENCES finance_categories(id) ON DELETE RESTRICT,
                amount_cents INTEGER NOT NULL,
                expense_date TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS finance_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                category_id INTEGER NOT NULL REFERENCES finance_categories(id) ON DELETE RESTRICT,
                amount_cents INTEGER NOT NULL,
                billing_day INTEGER NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS finance_wishlist_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                link TEXT NOT NULL,
                price_cents INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS reflection_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL,
                text_value TEXT NOT NULL DEFAULT '',
                attribution TEXT NOT NULL DEFAULT '',
                media_url TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS tracked_companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                source_type TEXT NOT NULL,
                source_key TEXT NOT NULL,
                careers_url TEXT NOT NULL DEFAULT '',
                category TEXT NOT NULL DEFAULT '',
                role_focus TEXT NOT NULL DEFAULT 'internships',
                is_active INTEGER NOT NULL DEFAULT 1,
                last_fetched_at TEXT,
                last_fetch_error TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS internship_postings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                company_id INTEGER NOT NULL REFERENCES tracked_companies(id) ON DELETE CASCADE,
                external_id TEXT NOT NULL,
                title TEXT NOT NULL,
                location TEXT NOT NULL DEFAULT '',
                team TEXT NOT NULL DEFAULT '',
                employment_type TEXT NOT NULL DEFAULT '',
                url TEXT NOT NULL DEFAULT '',
                description_text TEXT NOT NULL DEFAULT '',
                first_published_at TEXT,
                updated_at_remote TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                is_internship INTEGER NOT NULL DEFAULT 0,
                manual_bucket TEXT NOT NULL DEFAULT '',
                ai_summary TEXT NOT NULL DEFAULT '',
                is_applied INTEGER NOT NULL DEFAULT 0,
                fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, external_id)
            );

            CREATE TABLE IF NOT EXISTS app_notes (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                content TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            INSERT OR IGNORE INTO app_notes (id, content) VALUES (1, '');
            """
        )

        workout_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(workout_sessions)").fetchall()
        }
        if "run_miles" not in workout_columns:
            conn.execute("ALTER TABLE workout_sessions ADD COLUMN run_miles REAL")
        if "is_rest" not in workout_columns:
            conn.execute("ALTER TABLE workout_sessions ADD COLUMN is_rest INTEGER NOT NULL DEFAULT 0")

        task_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(tasks)").fetchall()
        }
        if "checklist_id" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN checklist_id INTEGER")
        if "priority" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'")
        if "is_misc" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN is_misc INTEGER NOT NULL DEFAULT 0")
        if "recurring_task_id" not in task_columns:
            conn.execute("ALTER TABLE tasks ADD COLUMN recurring_task_id INTEGER")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS recurring_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'medium',
                days_of_week TEXT NOT NULL DEFAULT '[]',
                end_date TEXT,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )

        internship_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(internship_postings)").fetchall()
        }
        if "manual_bucket" not in internship_columns:
            conn.execute(
                "ALTER TABLE internship_postings ADD COLUMN manual_bucket TEXT NOT NULL DEFAULT ''"
            )
        if "ai_summary" not in internship_columns:
            conn.execute(
                "ALTER TABLE internship_postings ADD COLUMN ai_summary TEXT NOT NULL DEFAULT ''"
            )
        if "is_applied" not in internship_columns:
            conn.execute(
                "ALTER TABLE internship_postings ADD COLUMN is_applied INTEGER NOT NULL DEFAULT 0"
            )

        company_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(tracked_companies)").fetchall()
        }
        if "category" not in company_columns:
            conn.execute(
                "ALTER TABLE tracked_companies ADD COLUMN category TEXT NOT NULL DEFAULT ''"
            )

        # Migrate tasks table to allow nullable task_date (for misc tasks)
        task_info = conn.execute("PRAGMA table_info(tasks)").fetchall()
        task_date_col = next((r for r in task_info if r["name"] == "task_date"), None)
        if task_date_col and task_date_col["notnull"]:
            conn.execute("PRAGMA foreign_keys = OFF")
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS tasks_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    text TEXT NOT NULL,
                    task_date TEXT,
                    completed INTEGER NOT NULL DEFAULT 0,
                    notes TEXT,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    checklist_id INTEGER,
                    priority TEXT NOT NULL DEFAULT 'medium',
                    is_misc INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            conn.execute(
                """
                INSERT INTO tasks_new
                    SELECT id, text, task_date, completed, notes, sort_order, created_at,
                           checklist_id,
                           COALESCE(priority, 'medium'),
                           COALESCE(is_misc, 0)
                    FROM tasks
                """
            )
            conn.execute("DROP TABLE tasks")
            conn.execute("ALTER TABLE tasks_new RENAME TO tasks")
            conn.execute("PRAGMA foreign_keys = ON")

        finance_category_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(finance_categories)").fetchall()
        }
        if "sort_order" not in finance_category_columns:
            conn.execute(
                "ALTER TABLE finance_categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0"
            )
        finance_categories = conn.execute(
            "SELECT id FROM finance_categories ORDER BY id ASC"
        ).fetchall()
        for index, row in enumerate(finance_categories, start=1):
            conn.execute(
                "UPDATE finance_categories SET sort_order = ? WHERE id = ? AND sort_order = 0",
                (index, row["id"]),
            )

        workout_has_data = conn.execute(
            "SELECT COUNT(*) AS count FROM workout_sessions"
        ).fetchone()["count"]
        if workout_has_data == 0:
            conn.execute(
                f"DELETE FROM workout_sections WHERE name IN ({','.join('?' for _ in LEGACY_WORKOUT_SECTIONS)})",
                LEGACY_WORKOUT_SECTIONS,
            )

        guitar_has_data = conn.execute(
            "SELECT COUNT(*) AS count FROM guitar_sessions"
        ).fetchone()["count"]
        if guitar_has_data == 0:
            conn.execute(
                f"DELETE FROM guitar_sections WHERE name IN ({','.join('?' for _ in LEGACY_GUITAR_SECTIONS)})",
                LEGACY_GUITAR_SECTIONS,
            )

        for name, order in DEFAULT_HABITS:
            conn.execute(
                """
                INSERT INTO habits(name, sort_order)
                VALUES(?, ?)
                ON CONFLICT(name) DO UPDATE SET sort_order = excluded.sort_order
                """,
                (name, order),
            )

        conn.execute("DELETE FROM habits WHERE name = '1 Hour Mauna'")
        leetcode_habit = conn.execute(
            "SELECT id FROM habits WHERE name = 'LeetCode'"
        ).fetchone()
        if leetcode_habit:
            conn.execute("DELETE FROM habit_logs WHERE habit_id = ?", (leetcode_habit["id"],))
            conn.execute("DELETE FROM habits WHERE id = ?", (leetcode_habit["id"],))

        old_habit = conn.execute(
            "SELECT id FROM habits WHERE name = 'Run/Workout'"
        ).fetchone()
        new_habit = conn.execute(
            "SELECT id FROM habits WHERE name = 'Exercise'"
        ).fetchone()
        if old_habit and new_habit:
            conn.execute(
                """
                INSERT INTO habit_logs(habit_id, log_date, completed, notes)
                SELECT ?, log_date, completed, notes
                FROM habit_logs
                WHERE habit_id = ?
                ON CONFLICT(habit_id, log_date) DO NOTHING
                """,
                (new_habit["id"], old_habit["id"]),
            )
            conn.execute("DELETE FROM habit_logs WHERE habit_id = ?", (old_habit["id"],))
            conn.execute("DELETE FROM habits WHERE id = ?", (old_habit["id"],))
        elif old_habit and not new_habit:
            conn.execute(
                "UPDATE habits SET name = 'Exercise' WHERE id = ?",
                (old_habit["id"],),
            )

        physical_exercise = conn.execute(
            "SELECT id FROM habits WHERE name = 'Physical Exercise'"
        ).fetchone()
        exercise = conn.execute(
            "SELECT id FROM habits WHERE name = 'Exercise'"
        ).fetchone()
        if physical_exercise and exercise:
            conn.execute(
                """
                INSERT INTO habit_logs(habit_id, log_date, completed, notes)
                SELECT ?, log_date, completed, notes
                FROM habit_logs WHERE habit_id = ?
                ON CONFLICT(habit_id, log_date) DO NOTHING
                """,
                (exercise["id"], physical_exercise["id"]),
            )
            conn.execute("DELETE FROM habit_logs WHERE habit_id = ?", (physical_exercise["id"],))
            conn.execute("DELETE FROM habits WHERE id = ?", (physical_exercise["id"],))
        elif physical_exercise and not exercise:
            conn.execute(
                "UPDATE habits SET name = 'Exercise' WHERE id = ?",
                (physical_exercise["id"],),
            )

        for section_name in DEFAULT_GUITAR_SECTIONS:
            conn.execute(
                "INSERT OR IGNORE INTO guitar_sections(name) VALUES(?)", (section_name,)
            )

        guitar_material_columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(guitar_materials)").fetchall()
        }
        if "notes" not in guitar_material_columns:
            conn.execute(
                "ALTER TABLE guitar_materials ADD COLUMN notes TEXT NOT NULL DEFAULT ''"
            )
        existing_guitar_material_titles = {
            row["title"].strip().lower()
            for row in conn.execute("SELECT title FROM guitar_materials").fetchall()
        }
        for order, title in enumerate(DEFAULT_GUITAR_MATERIALS, start=1):
            if title.strip().lower() not in existing_guitar_material_titles:
                conn.execute(
                    "INSERT INTO guitar_materials(title, notes, sort_order) VALUES(?, '', ?)",
                    (title, order),
                )
            else:
                conn.execute(
                    "UPDATE guitar_materials SET sort_order = ? WHERE LOWER(title) = LOWER(?)",
                    (order, title),
                )

        guitar_group_count = conn.execute(
            "SELECT COUNT(*) AS count FROM guitar_song_groups"
        ).fetchone()["count"]
        if guitar_group_count == 0:
            for order, name in enumerate(DEFAULT_GUITAR_SONG_GROUPS, start=1):
                conn.execute(
                    "INSERT INTO guitar_song_groups(name, sort_order) VALUES(?, ?)",
                    (name, order),
                )

        for section_name in DEFAULT_WORKOUT_SECTIONS:
            conn.execute(
                "INSERT OR IGNORE INTO workout_sections(name) VALUES(?)", (section_name,)
            )

        for order, category_name in enumerate(DEFAULT_FINANCE_CATEGORIES, start=1):
            conn.execute(
                """
                INSERT INTO finance_categories(name, sort_order)
                VALUES(?, ?)
                ON CONFLICT(name) DO NOTHING
                """,
                (category_name, order),
            )

        reflection_has_data = conn.execute(
            "SELECT COUNT(*) AS count FROM reflection_items"
        ).fetchone()["count"]
        if reflection_has_data == 0:
            for order, (text_value, attribution) in enumerate(DEFAULT_REFLECTION_QUOTES, start=1):
                conn.execute(
                    """
                    INSERT INTO reflection_items(item_type, text_value, attribution, media_url, sort_order)
                    VALUES('quote', ?, ?, '', ?)
                    """,
                    (text_value, attribution, order),
                )

            for order, text_value in enumerate(DEFAULT_REFLECTION_PROMPTS, start=1):
                conn.execute(
                    """
                    INSERT INTO reflection_items(item_type, text_value, attribution, media_url, sort_order)
                    VALUES('prompt', ?, '', '', ?)
                    """,
                    (text_value, order),
                )

            for order, text_value in enumerate(DEFAULT_REFLECTION_QUESTIONS, start=1):
                conn.execute(
                    """
                    INSERT INTO reflection_items(item_type, text_value, attribution, media_url, sort_order)
                    VALUES('question', ?, '', '', ?)
                    """,
                    (text_value, order),
                )

            for order, (text_value, media_url) in enumerate(DEFAULT_REFLECTION_VIDEOS, start=1):
                conn.execute(
                    """
                    INSERT INTO reflection_items(item_type, text_value, attribution, media_url, sort_order)
                    VALUES('video', ?, '', ?, ?)
                    """,
                    (text_value, media_url, order),
                )

        _merge_company_alias(conn, "Anduril Industries", "Anduril")

        for name, source_type, source_key, careers_url, category in DEFAULT_TRACKED_COMPANIES:
            conn.execute(
                """
                INSERT INTO tracked_companies(name, source_type, source_key, careers_url, category)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    source_type = excluded.source_type,
                    source_key = excluded.source_key,
                    careers_url = excluded.careers_url,
                    category = excluded.category,
                    role_focus = 'internships',
                    is_active = 1,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (name, source_type, source_key, careers_url, category),
            )

        habit_columns = {
            row["name"] for row in conn.execute("PRAGMA table_info(habits)").fetchall()
        }
        if "created_at" not in habit_columns:
            conn.execute(
                "ALTER TABLE habits ADD COLUMN created_at TEXT NOT NULL DEFAULT '2020-01-01T00:00:00'"
            )
        if "deleted_at" not in habit_columns:
            conn.execute(
                "ALTER TABLE habits ADD COLUMN deleted_at TEXT"
            )

    from ..services.companies import write_cowork_file

    write_cowork_file()
