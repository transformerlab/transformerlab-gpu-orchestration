# UpdateAPIKeyRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** |  | [optional] 
**is_active** | **bool** |  | [optional] 
**expires_in_days** | **int** |  | [optional] 
**scopes** | **List[str]** |  | [optional] 

## Example

```python
from openapi_client.models.update_api_key_request import UpdateAPIKeyRequest

# TODO update the JSON string below
json = "{}"
# create an instance of UpdateAPIKeyRequest from a JSON string
update_api_key_request_instance = UpdateAPIKeyRequest.from_json(json)
# print the JSON string representation of the object
print(UpdateAPIKeyRequest.to_json())

# convert the object into a dict
update_api_key_request_dict = update_api_key_request_instance.to_dict()
# create an instance of UpdateAPIKeyRequest from a dict
update_api_key_request_from_dict = UpdateAPIKeyRequest.from_dict(update_api_key_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


