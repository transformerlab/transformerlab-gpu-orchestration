# QuotaUsageResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**organization_quota** | [**OrganizationQuotaResponse**](OrganizationQuotaResponse.md) |  | 
**recent_usage** | [**List[GPUUsageLogResponse]**](GPUUsageLogResponse.md) |  | 
**total_usage_this_period** | **float** |  | 

## Example

```python
from openapi_client.models.quota_usage_response import QuotaUsageResponse

# TODO update the JSON string below
json = "{}"
# create an instance of QuotaUsageResponse from a JSON string
quota_usage_response_instance = QuotaUsageResponse.from_json(json)
# print the JSON string representation of the object
print(QuotaUsageResponse.to_json())

# convert the object into a dict
quota_usage_response_dict = quota_usage_response_instance.to_dict()
# create an instance of QuotaUsageResponse from a dict
quota_usage_response_from_dict = QuotaUsageResponse.from_dict(quota_usage_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


