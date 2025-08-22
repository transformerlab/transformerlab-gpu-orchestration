# AzureTestRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**subscription_id** | **str** |  | 
**tenant_id** | **str** |  | [optional] [default to '']
**client_id** | **str** |  | [optional] [default to '']
**client_secret** | **str** |  | [optional] [default to '']
**auth_mode** | **str** |  | [optional] [default to 'service_principal']

## Example

```python
from openapi_client.models.azure_test_request import AzureTestRequest

# TODO update the JSON string below
json = "{}"
# create an instance of AzureTestRequest from a JSON string
azure_test_request_instance = AzureTestRequest.from_json(json)
# print the JSON string representation of the object
print(AzureTestRequest.to_json())

# convert the object into a dict
azure_test_request_dict = azure_test_request_instance.to_dict()
# create an instance of AzureTestRequest from a dict
azure_test_request_from_dict = AzureTestRequest.from_dict(azure_test_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


