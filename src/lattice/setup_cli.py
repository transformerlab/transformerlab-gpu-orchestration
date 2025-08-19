#!/usr/bin/env python3
"""
Setup script for the Transformer Lab CLI
"""

from setuptools import setup, find_packages

setup(
    name="tlab",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    install_requires=[
        "rich>=10.0.0",
        "typer>=0.4.0",
    ],
    entry_points="""
        [console_scripts]
        tlab=cli.main:app
    """,
)
