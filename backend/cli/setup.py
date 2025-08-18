from setuptools import setup, find_packages

setup(
    name="transformer-lab-cli",
    version="0.1.0",
    description="Transformer Lab CLI Tool",
    packages=find_packages(),
    install_requires=[
        "click>=8.0.0",
        "typer>=0.9.0",
    ],
    entry_points={
        "console_scripts": [
            "lab=cli.main:app",
        ],
    },
    python_requires=">=3.8",
)
