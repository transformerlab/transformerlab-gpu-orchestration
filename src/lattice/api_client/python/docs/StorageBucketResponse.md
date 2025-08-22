# StorageBucketResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **str** |  | 
**name** | **str** |  | 
**remote_path** | **str** |  | 
**source** | **str** |  | [optional] 
**store** | **str** |  | [optional] 
**persistent** | **bool** |  | 
**mode** | **str** |  | 
**organization_id** | **str** |  | 
**created_by** | **str** |  | 
**created_at** | **str** |  | 
**updated_at** | **str** |  | 
**is_active** | **bool** |  | 

## Example

```python
from openapi_client.models.storage_bucket_response import StorageBucketResponse

# TODO update the JSON string below
json = "{}"
# create an instance of StorageBucketResponse from a JSON string
storage_bucket_response_instance = StorageBucketResponse.from_json(json)
# print the JSON string representation of the object
print(StorageBucketResponse.to_json())

# convert the object into a dict
storage_bucket_response_dict = storage_bucket_response_instance.to_dict()
# create an instance of StorageBucketResponse from a dict
storage_bucket_response_from_dict = StorageBucketResponse.from_dict(storage_bucket_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


