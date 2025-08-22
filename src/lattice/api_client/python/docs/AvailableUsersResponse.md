# AvailableUsersResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**users** | [**List[AvailableUser]**](AvailableUser.md) |  | 

## Example

```python
from openapi_client.models.available_users_response import AvailableUsersResponse

# TODO update the JSON string below
json = "{}"
# create an instance of AvailableUsersResponse from a JSON string
available_users_response_instance = AvailableUsersResponse.from_json(json)
# print the JSON string representation of the object
print(AvailableUsersResponse.to_json())

# convert the object into a dict
available_users_response_dict = available_users_response_instance.to_dict()
# create an instance of AvailableUsersResponse from a dict
available_users_response_from_dict = AvailableUsersResponse.from_dict(available_users_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


