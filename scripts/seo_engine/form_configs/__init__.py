"""
Form Configs Package
=====================
Provides form field mappings for directory submission forms.
Supports per-directory overrides via form_configs/overrides/{domain}.py.
Falls back to base_config.py for all fields not overridden.
"""

import importlib

from scripts.seo_engine.form_configs.base_config import get_base_config


def get_form_config(directory_domain: str) -> dict:
    """
    Load form field config for a directory domain.

    Checks for a per-directory override in form_configs/overrides/{domain_module}.py.
    If found, merges override fields on top of base config.
    Falls back to base_config for all unoverridden fields.

    Args:
        directory_domain: Directory domain (e.g. 'hotfrog.com')

    Returns:
        Dict mapping canonical field names to lists of locator strategies.
    """
    config = get_base_config()

    # Convert domain to valid Python module name (e.g. hotfrog.com -> hotfrog_com)
    module_name = directory_domain.replace(".", "_").replace("-", "_")

    try:
        override_module = importlib.import_module(
            f"scripts.seo_engine.form_configs.overrides.{module_name}"
        )
        if hasattr(override_module, "FIELD_OVERRIDES"):
            config.update(override_module.FIELD_OVERRIDES)
    except ModuleNotFoundError:
        pass  # No override for this directory -- use base config

    return config
