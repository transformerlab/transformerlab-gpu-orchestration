# OrganizationUserUsageResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**organization_id** | **str** |  | 
**period_start** | **str** |  | 
**period_end** | **str** |  | 
**quota_per_user** | **float** |  | 
**total_users** | **int** |  | 
**total_organization_usage** | **float** |  | 
**user_breakdown** | [**List[UserUsageBreakdown]**](UserUsageBreakdown.md) |  | 

## Example

```python
from openapi_client.models.organization_user_usage_response import OrganizationUserUsageResponse

# TODO update the JSON string below
json = "{}"
# create an instance of OrganizationUserUsageResponse from a JSON string
organization_user_usage_response_instance = OrganizationUserUsageResponse.from_json(json)
# print the JSON string representation of the object
print(OrganizationUserUsageResponse.to_json())

# convert the object into a dict
organization_user_usage_response_dict = organization_user_usage_response_instance.to_dict()
# create an instance of OrganizationUserUsageResponse from a dict
organization_user_usage_response_from_dict = OrganizationUserUsageResponse.from_dict(organization_user_usage_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


