"""
SkyPilot Catalog Utility for VM Pricing Information

This module provides utilities to fetch and parse VM pricing information
from the SkyPilot catalog for various cloud providers.
"""

import csv
import io
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
import requests
from pathlib import Path

logger = logging.getLogger(__name__)

# Base URLs for SkyPilot catalog
SKYPILOT_CATALOG_BASE = "https://raw.githubusercontent.com/skypilot-org/skypilot-catalog/refs/heads/master/catalogs/v7"

# Supported cloud providers and their catalog endpoints
SUPPORTED_CLOUDS = {
    "azure": f"{SKYPILOT_CATALOG_BASE}/azure/vms.csv",
    "runpod": f"{SKYPILOT_CATALOG_BASE}/runpod/vms.csv",
    "aws": f"{SKYPILOT_CATALOG_BASE}/aws/vms.csv",
    "gcp": f"{SKYPILOT_CATALOG_BASE}/gcp/vms.csv",
    "lambda": f"{SKYPILOT_CATALOG_BASE}/lambda/vms.csv",
    "oci": f"{SKYPILOT_CATALOG_BASE}/oci/vms.csv",
    "ibm": f"{SKYPILOT_CATALOG_BASE}/ibm/vms.csv",
    "scp": f"{SKYPILOT_CATALOG_BASE}/scp/vms.csv",
    "vsphere": f"{SKYPILOT_CATALOG_BASE}/vsphere/vms.csv",
    "kubernetes": f"{SKYPILOT_CATALOG_BASE}/kubernetes/vms.csv",
}

# Column mapping for different cloud providers
COLUMN_MAPPINGS = {
    "azure": {
        "instance_type": "InstanceType",
        "accelerator_name": "AcceleratorName",
        "accelerator_count": "AcceleratorCount",
        "vcpus": "vCPUs",
        "memory_gib": "MemoryGiB",
        "gpu_info": "GpuInfo",
        "price": "Price",
        "spot_price": "SpotPrice",
        "region": "Region",
        "generation": "Generation",
    },
    "runpod": {
        "instance_type": "InstanceType",
        "accelerator_name": "AcceleratorName",
        "accelerator_count": "AcceleratorCount",
        "vcpus": "vCPUs",
        "memory_gib": "MemoryGiB",
        "gpu_info": "GpuInfo",
        "price": "Price",
        "spot_price": "SpotPrice",
        "region": "Region",
        "availability_zone": "AvailabilityZone",
    },
    "aws": {
        "instance_type": "InstanceType",
        "accelerator_name": "AcceleratorName",
        "accelerator_count": "AcceleratorCount",
        "vcpus": "vCPUs",
        "memory_gib": "MemoryGiB",
        "gpu_info": "GpuInfo",
        "price": "Price",
        "spot_price": "SpotPrice",
        "region": "Region",
        "availability_zone": "AvailabilityZone",
    },
    "gcp": {
        "instance_type": "InstanceType",
        "accelerator_name": "AcceleratorName",
        "accelerator_count": "AcceleratorCount",
        "vcpus": "vCPUs",
        "memory_gib": "MemoryGiB",
        "gpu_info": "GpuInfo",
        "price": "Price",
        "spot_price": "SpotPrice",
        "region": "Region",
        "zone": "Zone",
    },
    # Default mapping for other providers
    "default": {
        "instance_type": "InstanceType",
        "accelerator_name": "AcceleratorName",
        "accelerator_count": "AcceleratorCount",
        "vcpus": "vCPUs",
        "memory_gib": "MemoryGiB",
        "gpu_info": "GpuInfo",
        "price": "Price",
        "spot_price": "SpotPrice",
        "region": "Region",
    },
}


@dataclass
class VMPricingInfo:
    """Data class for VM pricing information."""

    instance_type: str
    accelerator_name: Optional[str] = None
    accelerator_count: Optional[float] = None
    vcpus: float = 0.0
    memory_gib: float = 0.0
    gpu_info: Optional[str] = None
    price: Optional[float] = None
    spot_price: Optional[float] = None
    region: str = ""
    generation: Optional[str] = None
    cloud_provider: str = ""
    availability_zone: Optional[str] = None
    zone: Optional[str] = None

    def __post_init__(self):
        """Convert string values to appropriate types after initialization."""
        if isinstance(self.accelerator_count, str) and self.accelerator_count:
            try:
                # Handle empty strings, "N/A", "nan", etc.
                if self.accelerator_count.strip().lower() in [
                    "",
                    "n/a",
                    "nan",
                    "null",
                    "none",
                ]:
                    self.accelerator_count = None
                else:
                    self.accelerator_count = float(self.accelerator_count)
            except (ValueError, TypeError):
                self.accelerator_count = None

        if isinstance(self.vcpus, str):
            try:
                # Handle empty strings, "N/A", "nan", etc.
                if self.vcpus.strip().lower() in ["", "n/a", "nan", "null", "none"]:
                    self.vcpus = 0.0
                else:
                    self.vcpus = float(self.vcpus)
            except (ValueError, TypeError):
                self.vcpus = 0.0

        if isinstance(self.memory_gib, str):
            try:
                # Handle empty strings, "N/A", "nan", etc.
                if self.memory_gib.strip().lower() in [
                    "",
                    "n/a",
                    "nan",
                    "null",
                    "none",
                ]:
                    self.memory_gib = 0.0
                else:
                    self.memory_gib = float(self.memory_gib)
            except (ValueError, TypeError):
                self.memory_gib = 0.0

        if isinstance(self.price, str) and self.price:
            try:
                # Handle empty strings, "N/A", "nan", etc.
                if self.price.strip().lower() in ["", "n/a", "nan", "null", "none"]:
                    self.price = None
                else:
                    self.price = float(self.price)
            except (ValueError, TypeError):
                self.price = None

        if isinstance(self.spot_price, str) and self.spot_price:
            try:
                # Handle empty strings, "N/A", "nan", etc.
                if self.spot_price.strip().lower() in [
                    "",
                    "n/a",
                    "nan",
                    "null",
                    "none",
                ]:
                    self.spot_price = None
                else:
                    self.spot_price = float(self.spot_price)
            except (ValueError, TypeError):
                self.spot_price = None


class SkyPilotCatalogManager:
    """
    Manager class for fetching and caching VM pricing information from SkyPilot catalog.

    This class provides methods to:
    - Fetch pricing data from various cloud providers
    - Cache data to avoid repeated API calls
    - Search and filter VM instances by various criteria
    - Get pricing comparisons across regions and instance types
    """

    def __init__(self, cache_duration_hours: int = 24):
        """
        Initialize the catalog manager.

        Args:
            cache_duration_hours: How long to cache data before refreshing (default: 24 hours)
        """
        self.cache_duration_hours = cache_duration_hours
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._last_fetch: Dict[str, datetime] = {}

        # Create cache directory if it doesn't exist
        self.cache_dir = Path.home() / ".lattice" / "cache" / "skypilot_catalog"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _is_cache_valid(self, cloud_provider: str) -> bool:
        """Check if cached data for a cloud provider is still valid."""
        if cloud_provider not in self._last_fetch:
            return False

        cache_age = datetime.now() - self._last_fetch[cloud_provider]
        return cache_age < timedelta(hours=self.cache_duration_hours)

    def _load_from_cache(self, cloud_provider: str) -> Optional[List[VMPricingInfo]]:
        """Load data from local cache file."""
        cache_file = self.cache_dir / f"{cloud_provider}_vms.csv"
        if not cache_file.exists():
            return None

        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                instances = []
                for row in reader:
                    row["cloud_provider"] = cloud_provider
                    instances.append(VMPricingInfo(**row))
                return instances
        except Exception as e:
            logger.warning(f"Failed to load cache for {cloud_provider}: {e}")
            return None

    def _save_to_cache(self, cloud_provider: str, data: List[VMPricingInfo]):
        """Save data to local cache file."""
        cache_file = self.cache_dir / f"{cloud_provider}_vms.csv"
        try:
            with open(cache_file, "w", encoding="utf-8", newline="") as f:
                if data:
                    # Get field names from the first instance, excluding cloud_provider
                    fieldnames = [
                        f.name
                        for f in data[0].__dataclass_fields__.values()
                        if f.name != "cloud_provider"
                    ]
                    writer = csv.DictWriter(f, fieldnames=fieldnames)
                    writer.writeheader()
                    for instance in data:
                        # Create a copy without cloud_provider for CSV writing
                        row_data = {k: getattr(instance, k) for k in fieldnames}
                        writer.writerow(row_data)
        except Exception as e:
            logger.warning(f"Failed to save cache for {cloud_provider}: {e}")

    def _map_csv_row(self, row: Dict[str, str], cloud_provider: str) -> Dict[str, Any]:
        """Map CSV row to standardized format based on cloud provider."""
        mapping = COLUMN_MAPPINGS.get(cloud_provider, COLUMN_MAPPINGS["default"])
        mapped_row = {"cloud_provider": cloud_provider}

        # Map each field using the provider-specific column mapping
        for standard_field, csv_column in mapping.items():
            if csv_column in row:
                mapped_row[standard_field] = row[csv_column]
            else:
                # Set default values for missing columns
                if standard_field == "vcpus":
                    mapped_row[standard_field] = 0.0
                elif standard_field == "memory_gib":
                    mapped_row[standard_field] = 0.0
                elif standard_field in [
                    "accelerator_name",
                    "accelerator_count",
                    "gpu_info",
                    "price",
                    "spot_price",
                    "generation",
                    "availability_zone",
                    "zone",
                ]:
                    mapped_row[standard_field] = None
                elif standard_field == "region":
                    mapped_row[standard_field] = ""
                else:
                    mapped_row[standard_field] = ""

        return mapped_row

    async def fetch_cloud_catalog(
        self, cloud_provider: str, force_refresh: bool = False
    ) -> List[VMPricingInfo]:
        """
        Fetch VM catalog data for a specific cloud provider.

        Args:
            cloud_provider: The cloud provider (e.g., 'azure', 'runpod', 'aws')
            force_refresh: Force refresh even if cache is valid

        Returns:
            List of VMPricingInfo objects

        Raises:
            ValueError: If cloud provider is not supported
            requests.RequestException: If HTTP request fails
        """
        if cloud_provider not in SUPPORTED_CLOUDS:
            raise ValueError(
                f"Unsupported cloud provider: {cloud_provider}. "
                f"Supported providers: {list(SUPPORTED_CLOUDS.keys())}"
            )

        # Check cache first (unless forcing refresh)
        if not force_refresh and self._is_cache_valid(cloud_provider):
            cached_data = self._load_from_cache(cloud_provider)
            if cached_data:
                logger.info(f"Using cached data for {cloud_provider}")
                return cached_data

        # Fetch fresh data
        url = SUPPORTED_CLOUDS[cloud_provider]
        logger.info(f"Fetching fresh catalog data for {cloud_provider} from {url}")

        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()

            # Parse CSV data
            csv_text = response.text
            instances = self._parse_csv_data(csv_text, cloud_provider)

            # Update cache
            self._cache[cloud_provider] = {
                "data": instances,
                "timestamp": datetime.now(),
            }
            self._last_fetch[cloud_provider] = datetime.now()

            # Save to local cache
            self._save_to_cache(cloud_provider, instances)

            logger.info(
                f"Successfully fetched {len(instances)} instances for {cloud_provider}"
            )
            return instances

        except requests.RequestException as e:
            logger.error(f"Failed to fetch catalog for {cloud_provider}: {e}")
            # Try to return cached data if available
            cached_data = self._load_from_cache(cloud_provider)
            if cached_data:
                logger.info(
                    f"Returning cached data for {cloud_provider} due to fetch failure"
                )
                return cached_data
            raise

    def _parse_csv_data(
        self, csv_text: str, cloud_provider: str
    ) -> List[VMPricingInfo]:
        """Parse CSV text into VMPricingInfo objects."""
        instances = []

        try:
            csv_file = io.StringIO(csv_text)
            reader = csv.DictReader(csv_file)

            for row in reader:
                # Map CSV row to standardized format
                mapped_row = self._map_csv_row(row, cloud_provider)

                # Create VMPricingInfo object
                try:
                    instance = VMPricingInfo(**mapped_row)
                    instances.append(instance)
                except Exception as e:
                    instance_type = mapped_row.get("instance_type", "unknown")
                    logger.warning(
                        f"Failed to parse row for {cloud_provider}: {instance_type} - {e}"
                    )
                    continue

        except Exception as e:
            logger.error(f"Failed to parse CSV data for {cloud_provider}: {e}")
            raise

        return instances

    async def get_instance_types(
        self,
        cloud_provider: str,
        region: Optional[str] = None,
        min_vcpus: Optional[float] = None,
        max_vcpus: Optional[float] = None,
        min_memory_gib: Optional[float] = None,
        max_memory_gib: Optional[float] = None,
        has_gpu: Optional[bool] = None,
        gpu_type: Optional[str] = None,
    ) -> List[VMPricingInfo]:
        """
        Get filtered list of instance types based on criteria.

        Args:
            cloud_provider: The cloud provider
            region: Filter by specific region
            min_vcpus: Minimum vCPUs required
            max_vcpus: Maximum vCPUs allowed
            min_memory_gib: Minimum memory in GiB
            max_memory_gib: Maximum memory in GiB
            has_gpu: Whether instance has GPU (True/False) or any (None)
            gpu_type: Specific GPU type to filter by

        Returns:
            Filtered list of VMPricingInfo objects
        """
        instances = await self.fetch_cloud_catalog(cloud_provider)

        # Apply filters
        filtered = instances

        if region:
            filtered = [i for i in filtered if i.region.lower() == region.lower()]

        if min_vcpus is not None:
            filtered = [i for i in filtered if i.vcpus >= min_vcpus]

        if max_vcpus is not None:
            filtered = [i for i in filtered if i.vcpus <= max_vcpus]

        if min_memory_gib is not None:
            filtered = [i for i in filtered if i.memory_gib >= min_memory_gib]

        if max_memory_gib is not None:
            filtered = [i for i in filtered if i.memory_gib <= max_memory_gib]

        if has_gpu is not None:
            if has_gpu:
                filtered = [
                    i for i in filtered if i.accelerator_name and i.accelerator_count
                ]
            else:
                filtered = [
                    i
                    for i in filtered
                    if not i.accelerator_name or not i.accelerator_count
                ]

        if gpu_type:
            filtered = [
                i
                for i in filtered
                if i.accelerator_name and gpu_type.lower() in i.accelerator_name.lower()
            ]

        return filtered

    async def get_pricing_comparison(
        self,
        cloud_provider: str,
        instance_type: str,
        regions: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Get pricing comparison for a specific instance type across regions.

        Args:
            cloud_provider: The cloud provider
            instance_type: The instance type to compare
            regions: List of regions to compare (if None, compare all available)

        Returns:
            Dictionary with pricing comparison data
        """
        instances = await self.fetch_cloud_catalog(cloud_provider)

        # Filter by instance type
        matching_instances = [i for i in instances if i.instance_type == instance_type]

        if not matching_instances:
            return {
                "instance_type": instance_type,
                "cloud_provider": cloud_provider,
                "regions": [],
                "error": f"Instance type {instance_type} not found",
            }

        # Filter by regions if specified
        if regions:
            matching_instances = [
                i
                for i in matching_instances
                if i.region.lower() in [r.lower() for r in regions]
            ]

        # Group by region and calculate pricing
        region_data = {}
        for instance in matching_instances:
            region = instance.region
            if region not in region_data:
                region_data[region] = {
                    "on_demand_price": instance.price,
                    "spot_price": instance.spot_price,
                    "vcpus": instance.vcpus,
                    "memory_gib": instance.memory_gib,
                    "accelerator_info": {
                        "name": instance.accelerator_name,
                        "count": instance.accelerator_count,
                        "gpu_info": instance.gpu_info,
                    }
                    if instance.accelerator_name
                    else None,
                }

        return {
            "instance_type": instance_type,
            "cloud_provider": cloud_provider,
            "regions": region_data,
            "total_regions": len(region_data),
        }

    async def get_cost_optimization_suggestions(
        self,
        cloud_provider: str,
        target_vcpus: float,
        target_memory_gib: float,
        target_gpu_type: Optional[str] = None,
        use_spot: bool = True,
        max_price_per_hour: Optional[float] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get cost optimization suggestions based on requirements.

        Args:
            cloud_provider: The cloud provider
            target_vcpus: Target vCPUs needed
            target_memory_gib: Target memory needed in GiB
            target_gpu_type: Target GPU type (if needed)
            use_spot: Whether to prefer spot instances
            max_price_per_hour: Maximum price per hour willing to pay

        Returns:
            List of optimization suggestions sorted by cost efficiency
        """
        instances = await self.fetch_cloud_catalog(cloud_provider)

        # Filter instances that meet requirements
        suitable_instances = []
        for instance in instances:
            # Check if instance meets minimum requirements
            if (
                instance.vcpus >= target_vcpus
                and instance.memory_gib >= target_memory_gib
            ):
                # Check GPU requirements
                if target_gpu_type:
                    if not instance.accelerator_name:
                        continue
                    if target_gpu_type.lower() not in instance.accelerator_name.lower():
                        continue

                # Check price constraints
                price = (
                    instance.spot_price
                    if use_spot and instance.spot_price
                    else instance.price
                )
                if price is None:
                    continue

                # Ensure price is a float for comparison
                try:
                    price_float = float(price) if price is not None else None
                except (ValueError, TypeError):
                    continue

                if max_price_per_hour and price_float > max_price_per_hour:
                    continue

                suitable_instances.append(instance)

        # Sort by price (ascending)
        def get_price_for_sorting(instance):
            try:
                if use_spot and instance.spot_price:
                    return float(instance.spot_price)
                elif instance.price:
                    return float(instance.price)
                else:
                    return float("inf")
            except (ValueError, TypeError):
                return float("inf")

        suitable_instances.sort(key=get_price_for_sorting)

        # Generate suggestions
        suggestions = []
        for instance in suitable_instances[:10]:  # Top 10 suggestions
            price = (
                instance.spot_price
                if use_spot and instance.spot_price
                else instance.price
            )
            suggestions.append(
                {
                    "instance_type": instance.instance_type,
                    "region": instance.region,
                    "price_per_hour": price,
                    "price_type": "spot"
                    if use_spot and instance.spot_price
                    else "on_demand",
                    "vcpus": instance.vcpus,
                    "memory_gib": instance.memory_gib,
                    "accelerator_info": {
                        "name": instance.accelerator_name,
                        "count": instance.accelerator_count,
                        "gpu_info": instance.gpu_info,
                    }
                    if instance.accelerator_name
                    else None,
                    "cost_efficiency": (instance.vcpus * instance.memory_gib)
                    / (float(price) if price else 1)
                    if price
                    else 0,
                }
            )

        return suggestions

    def get_supported_clouds(self) -> List[str]:
        """Get list of supported cloud providers."""
        return list(SUPPORTED_CLOUDS.keys())

    def get_regions_for_cloud(self, cloud_provider: str) -> List[str]:
        """Get list of available regions for a cloud provider."""
        if cloud_provider not in self._cache:
            return []

        instances = self._cache[cloud_provider].get("data", [])
        regions = list(set(instance.region for instance in instances))
        regions.sort()
        return regions

    def clear_cache(self, cloud_provider: Optional[str] = None):
        """
        Clear cache for a specific cloud provider or all providers.

        Args:
            cloud_provider: Specific cloud provider to clear, or None for all
        """
        if cloud_provider:
            if cloud_provider in self._cache:
                del self._cache[cloud_provider]
            if cloud_provider in self._last_fetch:
                del self._last_fetch[cloud_provider]

            # Remove cache file
            cache_file = self.cache_dir / f"{cloud_provider}_vms.csv"
            if cache_file.exists():
                cache_file.unlink()
        else:
            self._cache.clear()
            self._last_fetch.clear()

            # Remove all cache files
            for cache_file in self.cache_dir.glob("*_vms.csv"):
                cache_file.unlink()

        logger.info(f"Cache cleared for {cloud_provider or 'all providers'}")


# Convenience functions for common operations
async def get_azure_vm_pricing(
    instance_type: str, region: Optional[str] = None
) -> Dict[str, Any]:
    """Get Azure VM pricing for a specific instance type and region."""
    manager = SkyPilotCatalogManager()
    return await manager.get_pricing_comparison(
        "azure", instance_type, [region] if region else None
    )


async def get_runpod_vm_pricing(
    instance_type: str, region: Optional[str] = None
) -> Dict[str, Any]:
    """Get RunPod VM pricing for a specific instance type and region."""
    manager = SkyPilotCatalogManager()
    return await manager.get_pricing_comparison(
        "runpod", instance_type, [region] if region else None
    )


async def find_cost_effective_instances(
    cloud_provider: str,
    vcpus: float,
    memory_gib: float,
    gpu_type: Optional[str] = None,
    max_price: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """Find cost-effective instances matching requirements."""
    manager = SkyPilotCatalogManager()
    return await manager.get_cost_optimization_suggestions(
        cloud_provider, vcpus, memory_gib, gpu_type, True, max_price
    )
