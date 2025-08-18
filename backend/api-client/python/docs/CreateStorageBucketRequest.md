# CreateStorageBucketRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **str** |  | 
**remote_path** | **str** |  | 
**source** | **str** |  | [optional] 
**store** | **str** |  | [optional] 
**persistent** | **bool** |  | [optional] [default to True]
**mode** | **str** |  | [optional] [default to 'MOUNT']

## Example

```python
from openapi_client.models.create_storage_bucket_request import CreateStorageBucketRequest

# TODO update the JSON string below
json = "{}"
# create an instance of CreateStorageBucketRequest from a JSON string
create_storage_bucket_request_instance = CreateStorageBucketRequest.from_json(json)
# print the JSON string representation of the object
print(CreateStorageBucketRequest.to_json())

# convert the object into a dict
create_storage_bucket_request_dict = create_storage_bucket_request_instance.to_dict()
# create an instance of CreateStorageBucketRequest from a dict
create_storage_bucket_request_from_dict = CreateStorageBucketRequest.from_dict(create_storage_bucket_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


