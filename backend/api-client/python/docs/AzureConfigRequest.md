# AzureConfigRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** |  | 
**subscription_id** | **str** |  | 
**tenant_id** | **str** |  | 
**client_id** | **str** |  | 
**client_secret** | **str** |  | 
**allowed_instance_types** | **List[str]** |  | 
**allowed_regions** | **List[str]** |  | 
**max_instances** | **int** |  | [optional] [default to 0]
**config_key** | **str** |  | [optional] 

## Example

```python
from openapi_client.models.azure_config_request import AzureConfigRequest

# TODO update the JSON string below
json = "{}"
# create an instance of AzureConfigRequest from a JSON string
azure_config_request_instance = AzureConfigRequest.from_json(json)
# print the JSON string representation of the object
print(AzureConfigRequest.to_json())

# convert the object into a dict
azure_config_request_dict = azure_config_request_instance.to_dict()
# create an instance of AzureConfigRequest from a dict
azure_config_request_from_dict = AzureConfigRequest.from_dict(azure_config_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


