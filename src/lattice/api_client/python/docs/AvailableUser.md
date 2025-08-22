# AvailableUser


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_id** | **str** |  | 
**email** | **str** |  | [optional] 
**first_name** | **str** |  | [optional] 
**last_name** | **str** |  | [optional] 
**profile_picture_url** | **str** |  | [optional] 
**has_team** | **bool** |  | [optional] 

## Example

```python
from openapi_client.models.available_user import AvailableUser

# TODO update the JSON string below
json = "{}"
# create an instance of AvailableUser from a JSON string
available_user_instance = AvailableUser.from_json(json)
# print the JSON string representation of the object
print(AvailableUser.to_json())

# convert the object into a dict
available_user_dict = available_user_instance.to_dict()
# create an instance of AvailableUser from a dict
available_user_from_dict = AvailableUser.from_dict(available_user_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


