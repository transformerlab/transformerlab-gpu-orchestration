# TeamResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **str** |  | 
**name** | **str** |  | 
**organization_id** | **str** |  | 
**created_by** | **str** |  | 
**created_at** | **str** |  | 
**updated_at** | **str** |  | 
**members** | [**List[TeamMemberResponse]**](TeamMemberResponse.md) |  | [optional] 

## Example

```python
from openapi_client.models.team_response import TeamResponse

# TODO update the JSON string below
json = "{}"
# create an instance of TeamResponse from a JSON string
team_response_instance = TeamResponse.from_json(json)
# print the JSON string representation of the object
print(TeamResponse.to_json())

# convert the object into a dict
team_response_dict = team_response_instance.to_dict()
# create an instance of TeamResponse from a dict
team_response_from_dict = TeamResponse.from_dict(team_response_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


