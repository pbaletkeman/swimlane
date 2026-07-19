from enum import StrEnum, auto

class UserRole(StrEnum):
    """
    Defines the system's available user roles.

    Attributes:
        WEB_ADMIN: Administrator with full system access and permissions.
        FACILITY_MANAGER: Manager capable of overseeing facility operations.
        COACH: Coach role with team and member management capabilities.
        MEMBER: End-user accessing platform and coaching services.
    """
    WEB_ADMIN = auto()
    FACILITY_MANAGER = auto()
    COACH = auto()
    MEMBER = auto()
