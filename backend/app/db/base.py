from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass

# Import models required for relationship resolution.
# Important: do NOT import `ScoringJob` here to avoid a circular import
# (`ScoringJob` imports `Base` from this module).
from app.models.recruiter import Recruiter  # noqa: F401, E402
from app.models.candidate import Candidate  # noqa: F401, E402
