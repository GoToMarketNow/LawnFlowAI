```yaml
openapi: 3.0.0
info:
  title: LawnFlow Agent Service API
  description: API for the LawnFlow Agent Service, which is responsible for orchestrating agentic workflows.
  version: 1.0.0

paths:
  /events:
    post:
      summary: Process an event
      description: Triggers an agentic workflow based on an incoming event. This is the main entry point for the agent service.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/EventPayload'
      responses:
        '200':
          description: Event processed successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProcessingResult'
        '400':
          description: Invalid request payload
        '500':
          description: Internal server error

  /actions/{id}/approve:
    post:
      summary: Approve a pending action
      description: Approves a pending action that requires human-in-the-loop confirmation.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                notes:
                  type: string
                  description: Optional notes from the user who is approving the action.
      responses:
        '200':
          description: Action approved successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string
        '400':
          description: Invalid request or action already resolved
        '404':
          description: Action not found
        '500':
          description: Internal server error

  /actions/{id}/reject:
    post:
      summary: Reject a pending action
      description: Rejects a pending action that requires human-in-the-loop confirmation.
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                notes:
                  type: string
                  description: Optional notes from the user who is rejecting the action.
      responses:
        '200':
          description: Action rejected successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  message:
                    type: string
        '400':
          description: Invalid request or action already resolved
        '404':
          description: Action not found
        '500':
          description: Internal server error

components:
  schemas:
    EventPayload:
      type: object
      properties:
        type:
          type: string
          enum: [missed_call, inbound_sms, web_lead, job_completed, quote_request]
        data:
          type: object
          description: The payload of the event, which varies depending on the event type.
        eventId:
          type: string
          description: A unique identifier for the event, used for idempotency.
      required:
        - type
        - data

    ProcessingResult:
      type: object
      properties:
        success:
          type: boolean
        message:
          type: string
        conversationId:
          type: integer
        eventId:
          type: integer
        planId:
          type: string
        actions:
          type: array
          items:
            type: string
        stoppedForApproval:
          type: boolean
        approvalId:
          type: string
```
