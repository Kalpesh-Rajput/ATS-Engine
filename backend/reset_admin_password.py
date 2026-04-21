import asyncio
import argparse
import getpass

from sqlalchemy import text

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal


DEFAULT_EMAIL = "admin@ats.com"


async def reset_admin_password(email: str, new_password: str) -> bool:
    async with AsyncSessionLocal() as db:
        row = (
            await db.execute(
                text("SELECT id FROM recruiters WHERE email = :email"),
                {"email": email},
            )
        ).first()

        if not row:
            return False

        await db.execute(
            text(
                """
                UPDATE recruiters
                SET hashed_password = :hashed_password,
                    is_active = TRUE,
                    is_admin = TRUE
                WHERE email = :email
                """
            ),
            {
                "hashed_password": hash_password(new_password),
                "email": email,
            },
        )
        await db.commit()
        return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset recruiter password")
    parser.add_argument("--email", default=DEFAULT_EMAIL, help="Recruiter email")
    parser.add_argument("--password", help="New password")
    args = parser.parse_args()

    email = args.email.strip() or DEFAULT_EMAIL

    if args.password:
        new_password = args.password.strip()
        confirm_password = new_password
    else:
        new_password = getpass.getpass("New password: ").strip()
        confirm_password = getpass.getpass("Confirm password: ").strip()

    if not new_password:
        print("Password cannot be empty.")
        return
    if new_password != confirm_password:
        print("Passwords do not match.")
        return

    updated = asyncio.run(reset_admin_password(email, new_password))
    if not updated:
        print(f"No recruiter found for email: {email}")
        return

    print(f"Password reset successful for {email}")


if __name__ == "__main__":
    main()
