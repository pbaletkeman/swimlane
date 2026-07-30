from pydantic import BaseModel


class Frequency(BaseModel):
    """Data model representing a frequency type for events."""

    frequency_id: int | None = None
    name: str
    day_interval: str
    is_active: bool = True
