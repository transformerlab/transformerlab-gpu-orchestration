# SendInvitationRequest


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**email** | **str** |  | 
**organization_id** | **str** |  | [optional] 
**expires_in_days** | **int** |  | [optional] 
**inviter_user_id** | **str** |  | [optional] 
**role_slug** | **str** |  | [optional] 

## Example

```python
from openapi_client.models.send_invitation_request import SendInvitationRequest

# TODO update the JSON string below
json = "{}"
# create an instance of SendInvitationRequest from a JSON string
send_invitation_request_instance = SendInvitationRequest.from_json(json)
# print the JSON string representation of the object
print(SendInvitationRequest.to_json())

# convert the object into a dict
send_invitation_request_dict = send_invitation_request_instance.to_dict()
# create an instance of SendInvitationRequest from a dict
send_invitation_request_from_dict = SendInvitationRequest.from_dict(send_invitation_request_dict)
```
[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


