# ClustersListResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**clusters** | **List[str]** |  | 

## Example

```python
from openapi_client.models.clusters_list_response import ClustersListResponse

# TODO update the JSON string below
json = "{}"
# create an instance of ClustersListResponse from a JSON string
clusters_list_response_instance = ClustersListResponse.from_json(json)
# print the JSON string representation of the object
print(ClustersListResponse.to_json())

# convert the object into a dict
clusters_list_response_dict = clusters_list_response_instance.to_dict()
# create an instance of ClustersListResponse from a dict
clusters_list_response_from_dict = ClustersListResponse.from_dict(clusters_list_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


