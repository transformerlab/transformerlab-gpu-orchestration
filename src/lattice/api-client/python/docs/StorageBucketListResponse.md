# StorageBucketListResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**buckets** | [**List[StorageBucketResponse]**](StorageBucketResponse.md) |  | 
**total_count** | **int** |  | 

## Example

```python
from openapi_client.models.storage_bucket_list_response import StorageBucketListResponse

# TODO update the JSON string below
json = "{}"
# create an instance of StorageBucketListResponse from a JSON string
storage_bucket_list_response_instance = StorageBucketListResponse.from_json(json)
# print the JSON string representation of the object
print(StorageBucketListResponse.to_json())

# convert the object into a dict
storage_bucket_list_response_dict = storage_bucket_list_response_instance.to_dict()
# create an instance of StorageBucketListResponse from a dict
storage_bucket_list_response_from_dict = StorageBucketListResponse.from_dict(storage_bucket_list_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


