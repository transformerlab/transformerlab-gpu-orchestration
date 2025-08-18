# UserQuotaResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_id** | **str** |  | 
**user_email** | **str** |  | [optional] 
**user_name** | **str** |  | [optional] 
**organization_id** | **str** |  | 
**monthly_gpu_hours_per_user** | **float** |  | 
**custom_quota** | **bool** |  | 
**created_at** | **str** |  | 
**updated_at** | **str** |  | 

## Example

```python
from openapi_client.models.user_quota_response import UserQuotaResponse

# TODO update the JSON string below
json = "{}"
# create an instance of UserQuotaResponse from a JSON string
user_quota_response_instance = UserQuotaResponse.from_json(json)
# print the JSON string representation of the object
print(UserQuotaResponse.to_json())

# convert the object into a dict
user_quota_response_dict = user_quota_response_instance.to_dict()
# create an instance of UserQuotaResponse from a dict
user_quota_response_from_dict = UserQuotaResponse.from_dict(user_quota_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


