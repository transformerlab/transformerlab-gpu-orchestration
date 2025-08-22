# UserUsageBreakdown


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_id** | **str** |  | 
**user_email** | **str** |  | [optional] 
**user_name** | **str** |  | [optional] 
**gpu_hours_used** | **float** |  | 
**gpu_hours_limit** | **float** |  | 
**gpu_hours_remaining** | **float** |  | 
**usage_percentage** | **float** |  | 

## Example

```python
from openapi_client.models.user_usage_breakdown import UserUsageBreakdown

# TODO update the JSON string below
json = "{}"
# create an instance of UserUsageBreakdown from a JSON string
user_usage_breakdown_instance = UserUsageBreakdown.from_json(json)
# print the JSON string representation of the object
print(UserUsageBreakdown.to_json())

# convert the object into a dict
user_usage_breakdown_dict = user_usage_breakdown_instance.to_dict()
# create an instance of UserUsageBreakdown from a dict
user_usage_breakdown_from_dict = UserUsageBreakdown.from_dict(user_usage_breakdown_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


