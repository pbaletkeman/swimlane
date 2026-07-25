# Bot Preference

## 🧠 Phase 1: Planning and Database Architecture -> Use MiMo-V2.5

FastAPI projects require clean data models (like SQLAlchemy or SQLModel) and structured database migration pipelines (like Alembic). MiMo-V2.5 is the smartest model in the group and excels here.Database Models: Use it to design relational databases, foreign keys, and complex indexes.Alembic Migrations: Ask MiMo to map out structural database changes without breaking production data.Async Logic: MiMo is excellent at structuring clean async/await database connections using engines like asyncpg.

## 🚀 Phase 2: Route Implementation and Schemas -> Use DeepSeek V4 Flash

Once the database structure is set, switch to DeepSeek V4 Flash to write the bulk of your application code.Pydantic V2 Schemas: DeepSeek is highly accurate at creating explicit BaseModel inputs and outputs for your API documentation.CRUD Endpoints: It is incredibly fast at generating boilerplate POST, GET, PUT, and DELETE endpoints.Live Context Execution: DeepSeek is highly efficient at reading your actual repository state, meaning it will perfectly match your existing route structures without inventing fake helper functions.

## 📦 Optional: Bulk Mock Data -> Use Big Pickle

If you need to quickly populate your database with dozens of rows of Python dicts, fake JSON payloads, or unit tests for your FastAPI routers, spin up Big Pickle.Its rapid-fire token generation makes it ideal for churning out mass boilerplate code.
