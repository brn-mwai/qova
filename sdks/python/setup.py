"""Qova Protocol Python SDK — financial trust infrastructure for AI agents."""

from setuptools import setup, find_packages

setup(
    name="qova",
    version="0.2.0",
    description="Python SDK for the Qova Protocol — financial trust infrastructure for AI agents on Base L2",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="Qova Engineering",
    author_email="eng@qova.cc",
    url="https://github.com/qova-protocol/qova-python",
    packages=find_packages(),
    python_requires=">=3.9",
    install_requires=[
        "httpx>=0.25.0",
    ],
    extras_require={
        "dev": ["pytest>=7.0", "pytest-asyncio>=0.23", "respx>=0.21"],
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries",
    ],
)
