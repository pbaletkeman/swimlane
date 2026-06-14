# sample launch.json file

see below for a sample launch.json file for vs code
---

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI Debug",
      "type": "python",
      "request": "launch",
      "module": "uvicorn",
      "args": [
        "main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
        "--reload"
      ],
      "jinja": true,
      "justMyCode": true,
      "python": "${workspaceFolder}/.venv/Scripts/python.exe",
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal",
      "env": {
        "PYTHONUNBUFFERED": "1"
      }
    },
    {
      "name": "Python: Current File",
      "type": "python",
      "request": "launch",
      "program": "${file}",
      "console": "integratedTerminal",
      "justMyCode": true,
      "python": "${workspaceFolder}/.venv/Scripts/python.exe",
      "cwd": "${workspaceFolder}"
    }
  ]
}
```
