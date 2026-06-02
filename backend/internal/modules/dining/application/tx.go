package application

import "context"

type TxRunner interface {
	Run(context.Context, func(context.Context) error) error
}
