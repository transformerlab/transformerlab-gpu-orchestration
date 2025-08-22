# UserQuotaListResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**organization_id** | **str** |  | 
**users** | [**List[UserQuotaResponse]**](UserQuotaResponse.md) |  | 
**default_quota_per_user** | **float** |  | 

## Example

```python
from openapi_client.models.user_quota_list_response import UserQuotaListResponse

# TODO update the JSON string below
json = "{}"
# create an instance of UserQuotaListResponse from a JSON string
user_quota_list_response_instance = UserQuotaListResponse.from_json(json)
# print the JSON string representation of the object
print(UserQuotaListResponse.to_json())

# convert the object into a dict
user_quota_list_response_dict = user_quota_list_response_instance.to_dict()
# create an instance of UserQuotaListResponse from a dict
user_quota_list_response_from_dict = UserQuotaListResponse.from_dict(user_quota_list_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


