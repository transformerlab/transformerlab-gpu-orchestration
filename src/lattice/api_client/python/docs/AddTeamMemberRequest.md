# AddTeamMemberRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**user_id** | **str** |  | 

## Example

```python
from openapi_client.models.add_team_member_request import AddTeamMemberRequest

# TODO update the JSON string below
json = "{}"
# create an instance of AddTeamMemberRequest from a JSON string
add_team_member_request_instance = AddTeamMemberRequest.from_json(json)
# print the JSON string representation of the object
print(AddTeamMemberRequest.to_json())

# convert the object into a dict
add_team_member_request_dict = add_team_member_request_instance.to_dict()
# create an instance of AddTeamMemberRequest from a dict
add_team_member_request_from_dict = AddTeamMemberRequest.from_dict(add_team_member_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


