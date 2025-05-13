import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin.firestore import FieldFilter # For newer where clause syntax
import telegram
from telegram.ext import ApplicationBuilder # For configuring bot options
from telegram.constants import ParseMode # For message formatting
import asyncio
import time
import os
from dotenv import load_dotenv

# --- Configuration ---
load_dotenv()

# Firebase
CREDENTIALS_PATH = os.getenv("FIREBASE_CREDENTIALS_PATH", "serviceAccountKey.json")
REPORTS_COLLECTION = 'reports'

# Telegram
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
GROUP_CHAT_ID_STR = os.getenv("TELEGRAM_GROUP_CHAT_ID")
GROUP_CHAT_ID = int(GROUP_CHAT_ID_STR) if GROUP_CHAT_ID_STR else None

if not BOT_TOKEN or not GROUP_CHAT_ID:
    print("Error: TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_CHAT_ID not set.")
    exit()

# --- Firebase Initialization ---
try:
    cred = credentials.Certificate(CREDENTIALS_PATH)
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("Firebase Admin SDK initialized successfully.")
except Exception as e:
    print(f"Error initializing Firebase Admin SDK: {e}")
    exit()

# --- Telegram Bot Initialization ---
try:
    # Use ApplicationBuilder to configure connection pool size and timeouts
    # For python-telegram-bot v20+
    application = (
        ApplicationBuilder()
        .token(BOT_TOKEN)
        .connection_pool_size(50)  # Increased pool size (default is often 10)
        .pool_timeout(60)          # Increased timeout to wait for a connection from the pool (default 1s)
        .connect_timeout(10)       # Timeout for establishing a connection
        .read_timeout(30)          # Timeout for reading a response
        .build()
    )
    bot = application.bot  # Get the bot instance from the application
    print(f"Telegram Bot initialized. Target Group Chat ID: {GROUP_CHAT_ID}. Connection pool size: 50")
except Exception as e:
    print(f"Error initializing Telegram Bot: {e}")
    exit()

# Keep track of notified reports
notified_resolved_reports = set()
notified_severe_threat_reports = set()

main_event_loop = None

# --- Async Helper for Sending Telegram Messages ---
async def send_telegram_message_async(chat_id, text, parse_mode_val):
    """Helper async function to send messages with retries."""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            await bot.send_message(chat_id=chat_id, text=text, parse_mode=parse_mode_val)
            return True
        except telegram.error.RetryAfter as e:
            wait_time = e.retry_after + 1  # Add a small buffer
            print(f"Flood control: RetryAfter {e.retry_after}s. Waiting {wait_time}s. Attempt {attempt + 1}/{max_retries} for chat_id {chat_id}.")
            if attempt + 1 >= max_retries:
                print(f"Max retries reached for chat_id {chat_id} after RetryAfter. Message not sent.")
                return False
            await asyncio.sleep(wait_time)
        except telegram.error.NetworkError as e:
            # This includes httpx.PoolTimeout which causes "All connections in the connection pool are occupied"
            wait_time = (attempt + 1) * 5  # Exponential backoff (5s, 10s, 15s)
            print(f"NetworkError for chat_id {chat_id}: {e}. Waiting {wait_time}s. Attempt {attempt + 1}/{max_retries}.")
            if attempt + 1 >= max_retries:
                print(f"Max retries reached for chat_id {chat_id} after NetworkError. Message not sent.")
                return False
            await asyncio.sleep(wait_time)
        except Exception as e:
            print(f"Generic send_message error for chat_id {chat_id}: {e}. Attempt {attempt + 1}/{max_retries}. Message not sent.")
            # For other errors, you might not want to retry or retry differently.
            # For simplicity here, we'll break after the first generic error.
            return False
    return False # Should only be reached if all retries fail

# --- Firestore Listener Callbacks ---

def on_severe_threat_snapshot(doc_snapshot, changes, read_time):
    global main_event_loop
    for change in changes:
        if change.type.name == 'ADDED':
            report_id = change.document.id
            if report_id in notified_severe_threat_reports:
                continue

            report_data = change.document.to_dict()
            print(f"New severe threat report detected: {report_id}")

            location = report_data.get('locationName', 'N/A')
            description = report_data.get('description', 'No description')
            category = report_data.get('category', 'N/A')
            urgency = report_data.get('urgency', 'N/A')
            threat = report_data.get('threat', 'N/A')
            image_url = report_data.get('imageUrl')
            lat = report_data.get('latitude')
            lon = report_data.get('longitude')

            maps_link = f"https://www.google.com/maps?q={lat},{lon}" if lat and lon else "N/A"

            message = (
                f"🚨 *New Severe Threat Report!* 🚨\n\n"
                f"*ID:* `{report_id}`\n"
                f"*Location:* {location}\n"
                f"*Category:* {category}\n"
                f"*Urgency:* {urgency}\n"
                f"*Threat:* {threat}\n"
                f"*Description:* {description}\n"
                f"*Maps:* {maps_link}\n"
            )
            if image_url:
                message += f"*Image:* [View Image]({image_url})\n"

            if main_event_loop and main_event_loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    send_telegram_message_async(
                        chat_id=GROUP_CHAT_ID,
                        text=message,
                        parse_mode_val=ParseMode.MARKDOWN # Use the imported constant
                    ),
                    main_event_loop
                )
                print(f"Scheduled severe threat notification for report: {report_id}")
            else:
                print(f"Error: Main event loop not available for report {report_id}.")
            notified_severe_threat_reports.add(report_id)


def on_resolved_snapshot(doc_snapshot, changes, read_time):
    global main_event_loop
    for change in changes:
        if change.type.name == 'MODIFIED' or change.type.name == 'ADDED':
            report_id = change.document.id
            report_data = change.document.to_dict()
            current_status = report_data.get('status')

            if current_status == 'Resolved':
                if report_id in notified_resolved_reports:
                    continue

                print(f"Report status changed to Resolved (or added as Resolved): {report_id}")

                location = report_data.get('locationName', 'N/A')
                description = report_data.get('description', 'No description')
                category = report_data.get('category', 'N/A')
                lat = report_data.get('latitude')
                lon = report_data.get('longitude')
                maps_link = f"https://www.google.com/maps?q={lat},{lon}" if lat and lon else "N/A"

                message = (
                    f"✅ *Report Resolved!* ✅\n\n"
                    f"*ID:* `{report_id}`\n"
                    f"*Location:* {location}\n"
                    f"*Category:* {category}\n"
                    f"*Description:* {description}\n"
                    f"*Maps Link:* {maps_link}\n"
                )

                if main_event_loop and main_event_loop.is_running():
                    asyncio.run_coroutine_threadsafe(
                        send_telegram_message_async(
                            chat_id=GROUP_CHAT_ID,
                            text=message,
                            parse_mode_val=ParseMode.MARKDOWN # Use the imported constant
                        ),
                        main_event_loop
                    )
                    print(f"Scheduled 'Resolved' notification for report: {report_id}")
                else:
                    print(f"Error: Main event loop not available for report {report_id}.")
                notified_resolved_reports.add(report_id)

            elif report_id in notified_resolved_reports and current_status != 'Resolved':
                print(f"Report {report_id} status changed from Resolved. Removing from notified_set.")
                notified_resolved_reports.discard(report_id)

async def main_program():
    global main_event_loop
    main_event_loop = asyncio.get_running_loop()

    severe_threat_query = db.collection(REPORTS_COLLECTION) \
        .where(filter=FieldFilter('threat', '==', 'Severe'))
    severe_threat_watch = severe_threat_query.on_snapshot(on_severe_threat_snapshot)
    print("Listening for new severe threat reports...")

    resolved_watch = db.collection(REPORTS_COLLECTION).on_snapshot(on_resolved_snapshot)
    print("Listening for reports becoming resolved...")

    stop_event = asyncio.Event()
    try:
        await stop_event.wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("Program interruption received.")
    finally:
        print("Stopping listeners...")
        if severe_threat_watch:
            severe_threat_watch.unsubscribe()
        if resolved_watch:
            resolved_watch.unsubscribe()
        print("Listeners stopped.")

if __name__ == "__main__":
    try:
        asyncio.run(main_program())
    except KeyboardInterrupt:
        print("Application terminated abruptly by user.")
    except Exception as e:
        print(f"An unexpected error occurred at the top level: {e}")
    finally:
        print("Application shutdown complete.")