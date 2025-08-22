# TeamListResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**teams** | [**List[TeamResponse]**](TeamResponse.md) |  | 
**total_count** | **int** |  | 

## Example

```python
from openapi_client.models.team_list_response import TeamListResponse

# TODO update the JSON string below
json = "{}"
# create an instance of TeamListResponse from a JSON string
team_list_response_instance = TeamListResponse.from_json(json)
# print the JSON string representation of the object
print(TeamListResponse.to_json())

# convert the object into a dict
team_list_response_dict = team_list_response_instance.to_dict()
# create an instance of TeamListResponse from a dict
team_list_response_from_dict = TeamListResponse.from_dict(team_list_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


