# UpdateStorageBucketRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** |  | [optional] 
**remote_path** | **str** |  | [optional] 
**source** | **str** |  | [optional] 
**store** | **str** |  | [optional] 
**persistent** | **bool** |  | [optional] 
**mode** | **str** |  | [optional] 
**is_active** | **bool** |  | [optional] 

## Example

```python
from openapi_client.models.update_storage_bucket_request import UpdateStorageBucketRequest

# TODO update the JSON string below
json = "{}"
# create an instance of UpdateStorageBucketRequest from a JSON string
update_storage_bucket_request_instance = UpdateStorageBucketRequest.from_json(json)
# print the JSON string representation of the object
print(UpdateStorageBucketRequest.to_json())

# convert the object into a dict
update_storage_bucket_request_dict = update_storage_bucket_request_instance.to_dict()
# create an instance of UpdateStorageBucketRequest from a dict
update_storage_bucket_request_from_dict = UpdateStorageBucketRequest.from_dict(update_storage_bucket_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


