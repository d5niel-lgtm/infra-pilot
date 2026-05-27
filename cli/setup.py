from setuptools import setup, find_packages

setup(
    name='infrapilot',
    version='1.0.0',
    description='Infra Pilot CLI - Infrastructure management command line tool',
    packages=find_packages(),
    include_package_data=True,
    install_requires=[],
    entry_points={
        'console_scripts': [
            'ipilot=ipilot.cli:main',
        ],
    },
    python_requires='>=3.9',
)
