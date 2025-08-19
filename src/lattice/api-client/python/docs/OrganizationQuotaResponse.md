# OrganizationQuotaResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**organization_id** | **str** |  | 
**monthly_gpu_hours_per_user** | **float** |  | 
**current_period_start** | **str** |  | 
**current_period_end** | **str** |  | 
**gpu_hours_used** | **float** |  | 
**gpu_hours_remaining** | **float** |  | 
**usage_percentage** | **float** |  | 

## Example

```python
from openapi_client.models.organization_quota_response import OrganizationQuotaResponse

# TODO update the JSON string below
json = "{}"
# create an instance of OrganizationQuotaResponse from a JSON string
organization_quota_response_instance = OrganizationQuotaResponse.from_json(json)
# print the JSON string representation of the object
print(OrganizationQuotaResponse.to_json())

# convert the object into a dict
organization_quota_response_dict = organization_quota_response_instance.to_dict()
# create an instance of OrganizationQuotaResponse from a dict
organization_quota_response_from_dict = OrganizationQuotaResponse.from_dict(organization_quota_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


