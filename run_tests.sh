#!/bin/bash
set -e

echo "🧪 Setting up environment and running tests..."

# Check uv
if ! command -v uv &> /dev/null; then
  echo "❌ uv is required but not installed."
  echo "💡 Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

# Create venv if missing and activate
if [ ! -d .venv ]; then
  echo "📦 Creating Python virtual environment with uv..."
  uv venv --python 3.10 --seed --clear
fi

source .venv/bin/activate
echo "✅ Virtual environment activated"

# Install dev dependencies (includes pytest)
echo "📦 Installing dev dependencies (editable + [dev])..."
uv pip install -e .[dev]

# Run tests (forward any args)
echo "▶️  Running pytest $@"
pytest "$@"

echo "🎉 Tests completed"

